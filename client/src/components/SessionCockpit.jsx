import { useState } from 'react'
import { HearthSprite, Ic } from './hearthUI.jsx'
import classesData from '../data/classes.json'
import QuickReferencePanel from './QuickReferencePanel.jsx'
import CompanionsPanel from './CompanionsPanel.jsx'
import InventoryPanel from './InventoryPanel.jsx'
import ConditionPanel from './ConditionPanel.jsx'
import '../styles/hearth.css'

/* ───────────────────────── Hearth DM Session Cockpit ─────────────────────────
   Faithful build of Hearth/Cockpit - Calm.html: dark-editorial three-column
   reading cockpit. Pure presentation — all session logic lives in DMSession.jsx,
   which renders this with state + handlers as props. Styles in hearth.css.
   Panels that need data the MVP doesn't track yet (scene weather/mood, spell-
   effect durations, dice receipts, speaker labels) are wired to real data where
   available and otherwise omitted rather than faked.
   ──────────────────────────────────────────────────────────────────────── */

const cap = (s) => (s == null || s === '') ? s : String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const hpKind = (cur, max) => { const r = max ? cur / max : 1; return r > 0.5 ? '' : r > 0.25 ? 'warn' : 'bad' }
const monogram = (name) => (name || '?').trim().charAt(0).toUpperCase()
const pct = (cur, max) => max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 100
const parseJson = (v, dflt) => { if (v == null) return dflt; if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return dflt } }

// short descriptions for the conditions we track, for the Active-effects rail
const COND_DESC = {
  blinded: "Can't see; attacks against you have advantage, yours have disadvantage.",
  charmed: "Can't attack the charmer; they have advantage on social checks against you.",
  frightened: 'Disadvantage while the source is in sight; you can\'t move closer to it.',
  grappled: 'Your speed is 0 until you break free.',
  incapacitated: "Can't take actions or reactions.",
  invisible: 'Unseen; attacks against you have disadvantage, yours have advantage.',
  paralyzed: 'Incapacitated; auto-fail Str/Dex saves; hits within 5 ft crit.',
  poisoned: 'Disadvantage on attack rolls and ability checks.',
  prone: 'Disadvantage to attack; melee attackers near you have advantage.',
  restrained: 'Speed 0; disadvantage on attacks and Dex saves.',
  stunned: 'Incapacitated; auto-fail Str/Dex saves.',
  unconscious: 'Incapacitated, prone, unaware; hits within 5 ft crit.'
}

export default function SessionCockpit(props) {
  const {
    character, companions = [], awayCompanions = [], secondCharacter, activeSession, sessionNumber,
    messages = [], isLoading, error, sessionRecap, onClearRecap,
    inputAction, onInputChange, onSend, messagesEndRef,
    combatState, onAdvanceTurn, onEndCombat,
    playerConditions = [], companionConditions = {}, onToggleCondition,
    spellSlots, gameDate, onRest, scene,
    useSonnet, onToggleModel,
    showQuickRef, setShowQuickRef, showInventory, setShowInventory,
    showConditionPanel, setShowConditionPanel, showCompanionsRef, setShowCompanionsRef,
    onOpenNotes,
    showEndOptions, onShowEnd, onCancelEnd, onPause, onComplete, onAbort,
    pendingRecruitment, recruitmentLoading, onConfirmRecruit, onDismissRecruit,
    itemsGainedThisSession, onDiscard, onCharacterUpdated, onSendActivity, onRecallCompanion
  } = props

  const [focused, setFocused] = useState(false)

  const level = character?.level || 1
  const classKey = character?.class?.toLowerCase()
  const classData = classesData[classKey]
  const isMonk = classKey === 'monk'
  const charName = character?.nickname || character?.name || 'You'
  const shortName = character?.nickname || character?.name?.split(' ')[0] || 'You'
  const speed = character?.speed || 30

  // ability scores (JSON column, or separate columns as fallback)
  const abil = parseJson(character?.ability_scores, null) || {
    str: character?.strength, dex: character?.dexterity, con: character?.constitution,
    int: character?.intelligence, wis: character?.wisdom, cha: character?.charisma
  }
  const abilMod = (k) => Math.floor((((abil?.[k]) ?? 10) - 10) / 2)
  const hitDie = classData?.hitDie || 8
  const conMod = abilMod('con')
  // HP / AC fall back to computed values when the stored ones are unset (0/0, AC 10)
  const computedMaxHp = Math.max(1, hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod))
  const maxHp = character?.max_hp > 0 ? character.max_hp : computedMaxHp
  const curHp = character?.current_hp > 0 ? character.current_hp : maxHp
  const ac = (() => {
    if (isMonk) return 10 + abilMod('dex') + abilMod('wis')
    if (classKey === 'barbarian') return 10 + abilMod('dex') + abilMod('con')
    return (character?.armor_class && character.armor_class > 0) ? character.armor_class : 10 + abilMod('dex')
  })()

  const actionLabel = secondCharacter
    ? `${charName} & ${secondCharacter.nickname || secondCharacter.name}`
    : charName

  // class abilities for the right rail — classes.json stores a flat `features`
  // array of "Name - description" strings; subclasses use featuresByLevel.
  const abilities = (() => {
    const out = []
    if (Array.isArray(classData?.features)) classData.features.forEach(f => {
      const s = String(f); const d = s.indexOf(' - ')
      out.push({ name: d > 0 ? s.slice(0, d).trim() : s.trim(), desc: d > 0 ? s.slice(d + 3).trim() : '' })
    })
    const sub = classData?.subclasses?.find(sc => sc.name === character?.subclass)
    if (sub?.featuresByLevel) Object.entries(sub.featuresByLevel).filter(([l]) => parseInt(l) <= level)
      .forEach(([l, fs]) => (fs || []).forEach(f => out.push({ name: f.name || String(f), desc: f.description || '' })))
    return out.slice(0, 7)
  })()

  const closeAll = () => { setShowQuickRef(false); setShowCompanionsRef(false); setShowInventory(false); setShowConditionPanel(false) }
  const openOnly = (setter, cur) => { closeAll(); setter(!cur) }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputAction.trim() && !isLoading) onSend(e)
    }
  }

  // narrative prose → paragraphs, with quoted speech tinted gold
  const renderProse = (text) => {
    const clean = String(text || '').replace(/\[SCENE:[^\]]+\]\s*/gi, '')
    const paras = clean.split(/\n\s*\n/).filter(p => p.trim())
    const src = paras.length ? paras : [clean]
    return src.map((p, i) => (
      <p key={i}>
        {p.split(/("[^"]*")/g).map((seg, j) => /^".*"$/.test(seg)
          ? <span key={j} style={{ color: 'var(--accent)', fontStyle: 'italic' }}>{seg}</span>
          : seg)}
      </p>
    ))
  }

  const renderMessage = (msg, idx) => {
    if (msg.type === 'action') {
      return (
        <div key={idx} className="you-act">
          <div className="inner">
            <div className="who">You · {actionLabel}</div>
            <div className="body">{msg.content}</div>
          </div>
        </div>
      )
    }
    if (msg.type === 'summary') {
      return (
        <div key={idx} className="measure">
          <div className="narr-card top"><div className="marker">Session summary</div><div className="ncbody">{msg.content}</div></div>
        </div>
      )
    }
    return (
      <div key={idx} className="measure dm">
        <div className="who">Dungeon Master</div>
        <div className="prose">{renderProse(msg.content)}</div>
      </div>
    )
  }

  // right-rail active effects from tracked conditions (no fake durations)
  const activeEffects = playerConditions.map(c => ({ name: cap(c), desc: COND_DESC[String(c).toLowerCase().replace(/_\d+$/, '')] || 'Active condition.' }))

  // scene panel — from [SCENE] markers the DM emits, plus what we already have
  const scenePlace = scene?.place || activeSession?.startingLocation?.name || (typeof activeSession?.startingLocation === 'string' ? activeSession.startingLocation : null) || null
  const sceneWhen = scene?.when || gameDate?.displayDate || null
  const sceneRows = [
    ['Place', scenePlace],
    ['Light', scene?.light],
    ['Weather', scene?.weather],
    ['Mood', scene?.mood],
    ['When', sceneWhen]
  ].filter(([, v]) => v)

  return (
    <div className="hearth cockpit-shell app-bg">
      <HearthSprite />

      {/* ───────── HEADER ───────── */}
      <header className="hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <div className="hdr-title">
          <span className="nm">{character?.name}</span>
          {sessionNumber ? <span className="sx">Session {sessionNumber}</span> : null}
        </div>
        <div className="spacer"></div>
        {isMonk && (
          <>
            <div className="ki-quick">
              <span className="kl">Ki</span>
              <div className="pips">{Array.from({ length: level }).map((_, i) => <span key={i} className="pip magic full" />)}</div>
            </div>
            <div className="vr"></div>
          </>
        )}
        <button className="btn ghost sm" disabled={isLoading} onClick={() => onRest('short')}><Ic n="coffee" />Short rest</button>
        <button className="btn ghost sm" disabled={isLoading} onClick={() => onRest('long')}><Ic n="moon" />Long rest</button>
        <div className="vr"></div>
        <div className="toggles">
          <button className="btn-icon" title="Quick reference" onClick={() => openOnly(setShowQuickRef, showQuickRef)}><Ic n="scroll" /></button>
          <button className="btn-icon" title="Inventory" onClick={() => openOnly(setShowInventory, showInventory)}><Ic n="pack" /></button>
          <button className="btn-icon" title="Conditions" onClick={() => openOnly(setShowConditionPanel, showConditionPanel)}><Ic n="tag" /></button>
          <button className="btn-icon" title="Campaign notes" onClick={onOpenNotes}><Ic n="pen" /></button>
        </div>
        <div className="vr"></div>
        <button className="opus" onClick={onToggleModel} title="Switch the DM model for the next turn" style={{ background: 'none', border: 0, cursor: 'pointer' }}>
          <span className="dot" style={useSonnet ? { background: 'var(--accent-2)', boxShadow: '0 0 7px var(--accent-2)' } : undefined}></span>{useSonnet ? 'Sonnet' : 'Opus'}
        </button>
        <button className="btn danger sm" onClick={onShowEnd}>End session</button>
      </header>

      {/* ───────── COCKPIT ───────── */}
      <main className="cockpit">

        {/* LEFT · party + scene */}
        <aside className="rail scroll">
          <section className="panel">
            <div className="panel-head">
              <svg className="ph-ic"><use href="#i-users" /></svg>
              <span className="ph-t">Party</span>
              <span className="ph-sub">{1 + companions.length}</span>
            </div>
            <div className="panel-body">
              <div className={`pm you${combatState && combatState.turnOrder?.[combatState.currentTurn]?.type === 'player' ? ' active' : ''}`}>
                <div className="mono-portrait d">{monogram(character?.name)}</div>
                <div>
                  <div className="pm-name"><span className="n">{shortName}</span><span className="r">you · L{level} {classKey}</span></div>
                  <div className="pm-meta">HP {curHp}/{maxHp} · AC {ac}</div>
                  <div className={`hpbar ${hpKind(curHp, maxHp)}`}><div className="fill" style={{ width: `${pct(curHp, maxHp)}%` }} /></div>
                  {playerConditions.length > 0 && (
                    <div className="pm-tags">{playerConditions.map((c, i) => <span key={i} className="chip">{cap(c)}</span>)}</div>
                  )}
                </div>
              </div>
              {companions.map((c, i) => {
                const cn = c.nickname || c.name
                const active = combatState && combatState.turnOrder?.[combatState.currentTurn]?.name === c.name
                return (
                  <div key={i} className={`pm${active ? ' active' : ''}`}>
                    <div className="mono-portrait v">{monogram(cn)}</div>
                    <div>
                      <div className="pm-name"><span className="n">{cn}</span><span className="r">L{c.level || level} {(c.class || '').toLowerCase()}</span></div>
                      <div className="pm-meta">HP {c.current_hp ?? '–'}/{c.max_hp ?? '–'}{c.armor_class ? ` · AC ${c.armor_class}` : ''}</div>
                      {c.max_hp ? <div className={`hpbar ${hpKind(c.current_hp, c.max_hp)}`}><div className="fill" style={{ width: `${pct(c.current_hp, c.max_hp)}%` }} /></div> : null}
                      {(companionConditions[c.name] || []).length > 0 && (
                        <div className="pm-tags">{(companionConditions[c.name] || []).map((t, j) => <span key={j} className="chip">{cap(t)}</span>)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
              {awayCompanions.map((c, i) => (
                <div key={`a${i}`} className="pm" style={{ opacity: 0.5 }}>
                  <div className="mono-portrait v">{monogram(c.name)}</div>
                  <div><div className="pm-name"><span className="n">{c.name}</span><span className="r">away</span></div></div>
                </div>
              ))}
            </div>
          </section>

          {sceneRows.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <svg className="ph-ic"><use href="#i-pin" /></svg>
                <span className="ph-t">This scene</span>
              </div>
              <div className="panel-body">
                {sceneRows.map(([k, v], i) => (
                  <div key={i} className="env-row"><span className="k">{k}</span><span className="v">{v}</span></div>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* CENTER · reading stage */}
        <section className="stage">
          <div className="context-strip">
            {combatState && <><span className="cs-campaign" style={{ color: 'var(--combat)' }}>Combat · round {combatState.round || 1}</span><span className="cs-dot"></span></>}
            <span className="cs-campaign">{activeSession?.title || 'Adventure'}</span>
            {scenePlace && <><span className="cs-dot"></span><span className="cs-loc">{scenePlace}</span></>}
            {sceneWhen && <span className="cs-time"><svg className="ic" style={{ width: 12, height: 12 }}><use href="#i-clock" /></svg>{sceneWhen}</span>}
          </div>

          <div className="transcript scroll">
            {sessionRecap && (
              <div className="measure">
                <div className="narr-card"><div className="marker">Previously…</div><div className="ncbody">{sessionRecap}</div>
                  <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={onClearRecap}>Continue</button></div>
              </div>
            )}
            {messages.map(renderMessage)}
            {isLoading && (
              <div className="measure dm"><div className="who">Dungeon Master</div>
                <div className="prose" style={{ color: 'var(--ink-3)' }}>The Dungeon Master is writing…</div></div>
            )}
            {error && <div className="measure"><div className="sys" style={{ color: 'var(--bad)' }}>{error}</div></div>}
            <div ref={messagesEndRef} />
          </div>

          {/* COMPOSER */}
          <div className="composer">
            <div className="composer-inner">
              <div className={`writing-surface${focused ? ' focused' : ''}`}>
                <textarea
                  value={inputAction}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={secondCharacter ? 'What do you both do?' : 'What do you do?'}
                  disabled={isLoading}
                  autoFocus
                  rows={2}
                  style={{ width: '100%', resize: 'none', background: 'transparent', border: 0, outline: 0, fontFamily: 'var(--serif)', fontSize: 17, lineHeight: 1.55, color: 'var(--ink)', minHeight: 46 }}
                />
              </div>
              <div className="composer-bar">
                <span className="composer-hint">{isLoading ? 'The Dungeon Master is writing…' : 'Speak, act, or ask — the table is yours.'}</span>
                <span className="spacer"></span>
                <button className="btn primary" disabled={isLoading || !inputAction.trim()} onClick={onSend}><Ic n="send" />Send</button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT · mechanics */}
        <aside className="rail scroll">
          <section className="panel">
            <div className="panel-head">
              <svg className="ph-ic"><use href="#i-shield" /></svg>
              <span className="ph-t">{shortName}</span>
              <span className="ph-sub">L{level} {classKey}</span>
            </div>
            <div className="panel-body">
              <div className="vitals">
                <div className="vital hp">
                  <div className="vl">Hit points</div>
                  <div className="vv" style={{ color: hpKind(curHp, maxHp) === 'bad' ? 'var(--bad)' : hpKind(curHp, maxHp) === 'warn' ? 'var(--warn)' : 'var(--good)' }}>{curHp}<span className="max"> / {maxHp}</span></div>
                  <div className={`hptrack ${hpKind(curHp, maxHp)}`}><div className="fill" style={{ width: `${pct(curHp, maxHp)}%` }} /></div>
                </div>
                <div className="vital"><div className="vl">Armor</div><div className="vv">{ac}</div></div>
                <div className="vital"><div className="vl">Speed</div><div className="vv">{speed}<span className="un"> ft</span></div></div>
              </div>
              {isMonk && (
                <>
                  <div style={{ height: 11 }}></div>
                  <div className="ki-block"><span className="kl">Ki points</span><div className="pips">{Array.from({ length: level }).map((_, i) => <span key={i} className="pip magic full" />)}</div></div>
                </>
              )}
              <div className="hr-soft" style={{ margin: '10px 0' }}></div>
              <div className="ki-block"><span className="kl">Gold</span><span className="num" style={{ fontSize: 15, color: 'var(--accent)' }}>{character?.gold_gp ?? 0} <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>gp</span></span></div>
            </div>
          </section>

          {activeEffects.length > 0 && (
            <section className="panel">
              <div className="panel-head"><svg className="ph-ic"><use href="#i-sparkles" /></svg><span className="ph-t">Active effects</span></div>
              <div className="panel-body">
                {activeEffects.map((e, i) => (
                  <div key={i} className="effect">
                    <svg className="ei"><use href="#i-flame" /></svg>
                    <div><div className="en">{e.name}</div><div className="es">{e.desc}</div></div>
                    <span className="et" style={{ cursor: 'pointer' }} title="Clear" onClick={() => onToggleCondition(playerConditions[i], 'player')}>clear</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {combatState?.turnOrder?.length > 0 && (
            <section className="panel">
              <div className="panel-head"><svg className="ph-ic"><use href="#i-bolt" /></svg><span className="ph-t">Initiative</span><span className="ph-sub">round {combatState.round || 1}</span></div>
              <div className="panel-body">
                {combatState.turnOrder.map((t, i) => (
                  <div key={i} className="abil-row" style={i === combatState.currentTurn ? { borderColor: 'color-mix(in oklab, var(--combat) 50%, var(--rule))' } : i < combatState.currentTurn ? { opacity: 0.5 } : undefined}>
                    <span className="an" style={t.type === 'enemy' ? { color: 'var(--bad)' } : undefined}>{i + 1}. {t.name}</span><span className="ac">{t.type}</span>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 9 }}>
                  <button className="btn sm" onClick={onAdvanceTurn}>Next turn</button>
                  <button className="btn ghost sm" onClick={onEndCombat}>End combat</button>
                </div>
              </div>
            </section>
          )}

          {abilities.length > 0 && (
            <section className="panel">
              <div className="panel-head"><svg className="ph-ic"><use href="#i-bolt" /></svg><span className="ph-t">{isMonk ? 'Ki abilities' : 'Class features'}</span></div>
              <div className="panel-body">
                {abilities.map((a, i) => (
                  <div key={i} className="abil-row" style={{ alignItems: 'flex-start' }}>
                    <div><div className="an">{a.name}</div>{a.desc ? <div className="ades">{a.desc}</div> : null}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </main>

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
            <div className="modal-head"><h3>End this session?</h3></div>
            <div className="modal-body">
              <button className="mchoice primary" disabled={isLoading} onClick={onPause}>
                <span className="mci"><Ic n="pause" /></span>
                <span><span className="mct">Pause &amp; leave</span><span className="mcd">Set the scene down exactly here. Pick up on this beat next time.</span></span>
              </button>
              <button className="mchoice" disabled={isLoading} onClick={onComplete}>
                <span className="mci"><Ic n="check" /></span>
                <span><span className="mct">Complete the session</span><span className="mcd">Wrap here, bank rewards, and tidy a recap of what happened.</span></span>
              </button>
              <button className="mchoice danger" disabled={isLoading} onClick={onAbort}>
                <span className="mci"><Ic n="x" /></span>
                <span><span className="mct">Abandon</span><span className="mcd">Discard everything since your last save. This cannot be undone.</span></span>
              </button>
            </div>
            <div className="modal-foot"><button className="btn ghost" disabled={isLoading} onClick={onCancelEnd}>Keep playing</button></div>
          </div>
        </div>
      )}

      {/* recruitment modal */}
      {pendingRecruitment && (
        <div className="scrim" onClick={onDismissRecruit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="meyebrow">An ally at the door</div><h3>Travel with {pendingRecruitment.npc?.name || pendingRecruitment.npcName}?</h3></div>
            <div className="modal-body">
              <div className="cpv">
                <span className="cpc">{monogram(pendingRecruitment.npc?.name || pendingRecruitment.npcName)}</span>
                <div>
                  <div className="cpn">{pendingRecruitment.npc?.name || pendingRecruitment.npcName}</div>
                  <div className="cpr">{[pendingRecruitment.npc?.race, pendingRecruitment.npc?.occupation].filter(Boolean).join(' · ') || 'A new companion'}</div>
                </div>
              </div>
              {pendingRecruitment.npcNotFound && (
                <p className="help" style={{ marginTop: 14 }}>They aren't in your NPC records yet — you can add them as a companion later.</p>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" disabled={recruitmentLoading} onClick={onDismissRecruit}>{pendingRecruitment.npcNotFound ? 'Got it' : 'Not now'}</button>
              {!pendingRecruitment.npcNotFound && (
                <button className="btn primary" disabled={recruitmentLoading} onClick={() => onConfirmRecruit('npc_stats')}><Ic n="check" />{recruitmentLoading ? 'Adding…' : 'Welcome them'}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
