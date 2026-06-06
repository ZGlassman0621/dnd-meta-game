import { useState } from 'react'
import '../styles/hearth.css'
import '../styles/hearth-begincampaign.css'

/**
 * Begin a new Campaign — the conversational atelier where Opus authors the
 * world while the player sets the mood (design_handoff_hearth_app/Begin
 * Campaign.html). Two states: a Greeting (who/seed/prompt) and a Compose
 * atelier (manuscript dialogue thread + premise/scene cards + a rail of dials),
 * ending in a cinematic "Begin the first session" that drops into the cockpit.
 *
 * Wired to the real backend: POST /api/campaign/draft (Opus authors/refines the
 * draft) and POST /api/campaign/begin (creates the campaign + plan, links the
 * character). On Begin, /api/dm-session/start runs under the cinematic so the
 * player lands directly in the live session.
 *
 * Props: { character, onBack, onBegun }.
 */

const NUDGES = [
  { k: 'darker', label: 'Darker' },
  { k: 'hopeful', label: 'More hopeful' },
  { k: 'stakes', label: 'Raise the stakes' },
  { k: 'intimate', label: 'Keep it intimate' },
  { k: 'oneshot', label: 'Make it a one-shot' },
  { k: 'regen', label: 'Regenerate', regen: true }
]
const NUDGE_LABEL = Object.fromEntries(NUDGES.map(n => [n.k, n.label]))
const SCOPES = [{ v: 'one', t: 'One-shot' }, { v: 'arc', t: 'Short arc' }, { v: 'open', t: 'Open-ended' }]

const Ic = ({ n }) => <svg className="ic"><use href={`#bc-${n}`} /></svg>

// Render Opus's *asterisk* emphasis as italic <em>.
function emph(text) {
  if (!text) return null
  return String(text).split(/\*([^*]+)\*/g).map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : p))
}

async function callDraft(payload) {
  const res = await fetch('/api/campaign/draft', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  })
  if (!res.ok) { let m = ''; try { m = (await res.json()).error } catch {} throw new Error(m || `Opus couldn't draft that (HTTP ${res.status})`) }
  return (await res.json()).draft
}

export default function BeginCampaign({ character, onBack, onBegun }) {
  const [mode, setMode] = useState('greet')         // 'greet' | 'compose'
  const [subject, setSubject] = useState(character?.id ?? 'world')
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [turns, setTurns] = useState([])             // { type:'opus'|'you', text, label? }
  const [thinking, setThinking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [compInput, setCompInput] = useState('')
  // rail dials (seeded by Opus; scope is player-tunable)
  const [scope, setScope] = useState('arc')
  const [tones, setTones] = useState([])
  const [party, setParty] = useState([])             // added ally pills (stub)
  const [inheritSettings, setInheritSettings] = useState(true)
  // cinematic
  const [cinema, setCinema] = useState(false)
  const [cinemaRun, setCinemaRun] = useState(false)

  const charName = character ? (character.name || [character.first_name, character.last_name].filter(Boolean).join(' ') || 'your character') : null
  const glyph = (character?.glyph || character?.first_name || character?.name || '?').charAt(0).toUpperCase()
  const hasBackstory = !!(character?.backstory || character?.parsed_backstory)

  // ── draft generation ──────────────────────────────────────────────────────
  const beginWithOpus = async ({ promptOverride, seedOverride } = {}) => {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const d = await callDraft({
        prompt: promptOverride ?? prompt,
        subject, seed: seedOverride || null,
        characterId: character?.id || null,
        dials: { scope, tones }
      })
      setDraft(d); setScope(d.scope || scope); setTones(d.tones || [])
      setTurns([{ type: 'opus', text: d.opusMessage || '' }])
      setMode('compose')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const refine = async ({ nudge, userNote }) => {
    if (loading || !draft) return
    setTurns(t => [...t, { type: 'you', label: nudge ? 'You nudged' : 'You asked for', text: nudge ? NUDGE_LABEL[nudge] : userNote }])
    if (!nudge) setCompInput('')
    setLoading(true); setThinking(true); setError(null)
    try {
      const d = await callDraft({ priorDraft: draft, nudge: nudge || null, userNote: userNote || null, characterId: character?.id || null, subject })
      setDraft(d); setScope(d.scope || scope); setTones(d.tones || [])
      setTurns(t => [...t, { type: 'opus', text: d.opusMessage || '' }])
    } catch (e) { setError(e.message) } finally { setThinking(false); setLoading(false) }
  }

  const sendComposer = () => { const v = compInput.trim(); if (v && !loading) refine({ userNote: v }) }

  // ── commit ──────────────────────────────────────────────────────────────
  const begin = async () => {
    if (loading || !draft || !character?.id) {
      if (!character?.id) setError('Select a character before beginning a campaign.')
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/campaign/begin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, characterId: character.id })
      })
      if (!res.ok) { let m = ''; try { m = (await res.json()).error } catch {} throw new Error(m || 'Could not begin the campaign.') }
      // Cinematic plays while Opus sets the opening scene (the /start call).
      setCinema(true)
      requestAnimationFrame(() => setCinemaRun(true))
      const startReq = fetch('/api/dm-session/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, providerPreference: 'auto' })
      }).catch(() => {}) // if start fails, we still land on the (Hearth) session setup
      await Promise.all([startReq, new Promise(r => setTimeout(r, 3600))])
      onBegun && onBegun()
    } catch (e) { setError(e.message); setLoading(false); setCinema(false); setCinemaRun(false) }
  }

  // ── derived display ───────────────────────────────────────────────────────
  const sceneSub = draft?.setting?.sub || ''
  const openingFirstLine = (draft?.openingScene || '').trim()
  const cinemaLine = openingFirstLine.split(/(?<=[.!?])\s+/)[0] || openingFirstLine

  return (
    <div className="hearth app-bg begin-campaign">
      <BCSprite />

      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr" />
        <button type="button" className="back" onClick={onBack}><Ic n="arrow-left" />{charName ? `${charName}'s home` : 'Back'}</button>
        <div className="spacer" />
        <span className="opus"><span className="dot" />Opus</span>
      </header>

      <main className="atelier">
        <div className="at-eyebrow">
          <span className="eyebrow">New campaign</span>
          <span className="ln" />
          {mode === 'compose' && (
            <button className="restart" type="button" onClick={() => { setMode('greet'); setDraft(null); setTurns([]); setError(null) }}>
              <Ic n="refresh" />Start over
            </button>
          )}
        </div>

        {error && (
          <div style={{ maxWidth: 660, margin: '0 0 20px', padding: '12px 16px', borderRadius: 11, background: 'color-mix(in oklab, var(--bad) 12%, var(--bg-card))', border: '1px solid color-mix(in oklab, var(--bad) 40%, var(--rule))', color: 'var(--bad)', fontFamily: 'var(--serif)', fontSize: 15 }}>
            {error}
          </div>
        )}

        {mode === 'greet' ? (
          /* ─────────── GREETING ─────────── */
          <section className="greet" style={{ display: 'block' }}>
            <div className="greet-hero">
              <div className="greet-op"><span className="orb">O</span><span className="lbl">Opus</span></div>
              <h2>Every campaign begins as a single sentence. Tell me yours.</h2>
              <p className="askp">I'll take whatever you give me — a mood, a place, a wound your character still carries — and build the world around it: its people, its map, the truth at its centre. <em>You set the weather. I'll write the storm.</em></p>

              <p className="glabel">Who walks into this story?</p>
              <div className="who-row">
                {character && (
                  <button className={`whoc${subject === character.id ? ' sel' : ''}`} type="button" onClick={() => setSubject(character.id)}>
                    <span className="crest"><span className="mono">{glyph}</span>{character.level ? <span className="lvl">{character.level}</span> : null}</span>
                    <span className="wc-txt"><span className="wc-t">{charName}</span><br /><span className="wc-s">{[character.race_label || character.race, character.class_label || character.class, character.level ? `level ${character.level}` : null].filter(Boolean).join(' · ')}</span></span>
                  </button>
                )}
                <button className={`whoc${subject === 'world' ? ' sel' : ''}`} type="button" onClick={() => setSubject('world')}>
                  <span className="wc-blank"><Ic n="globe" /></span>
                  <span className="wc-txt"><span className="wc-t">Start from the world</span><br /><span className="wc-s">Build it first, choose a hero later</span></span>
                </button>
              </div>

              <p className="glabel">Or begin from a seed</p>
              <div className="seed-row">
                {hasBackstory && (
                  <button className="seedc" type="button" disabled={loading}
                    onClick={() => beginWithOpus({ promptOverride: "Build this campaign from my character's own history — their unfinished business and the people from their past." })}>
                    <span className="stag"><span className="dot" />From your backstory</span>
                    <h4>Your own history</h4>
                    <p>Draw the campaign from the unfinished business and people your character carries.</p>
                  </button>
                )}
                <button className="seedc" type="button" disabled={loading} onClick={() => beginWithOpus({ seedOverride: 'surprise' })}>
                  <span className="stag"><span className="dot" />Opus's choice</span>
                  <h4>Surprise me</h4>
                  <p>Give me only your character, and I'll find the story that fits the shape of them.</p>
                </button>
              </div>

              <p className="glabel">What do you want to play?</p>
              <div className="prompt-wrap">
                <textarea className="prompt-box" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={loading}
                  placeholder="A rain-soaked political mystery in a sinking canal city… a slow horror in a town that's forgotten how to grieve… or just a word: revenge, pilgrimage, heist." />
                <button className="btn primary prompt-send" type="button" disabled={loading || !prompt.trim()} onClick={() => beginWithOpus()}>
                  <Ic n="send" />{loading ? 'Opus is writing…' : 'Begin with Opus'}
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* ─────────── COMPOSE ─────────── */
          <div className="at-grid">
            <section className="thread-col">
              <h1 className="at-title">Opus is writing <span className="it">{draft?.title}</span></h1>
              <p className="at-sub">A draft in progress · nudge it below, or begin when it feels right.</p>

              <div className="thread">
                {turns.map((t, i) => t.type === 'opus' ? (
                  <div className="turn op" key={i}>
                    <div className="who"><span className="orb">O</span></div>
                    <div className="body"><div className="speaker">Opus</div><div className="prose">{emph(t.text)}</div></div>
                  </div>
                ) : (
                  <div className="turn you" key={i}>
                    <div className="you-note"><span className="yl">{t.label}</span>{t.text}</div>
                  </div>
                ))}

                {/* the living draft */}
                {draft && (
                  <>
                    <div className="premise-card">
                      <div className="pc-head">
                        <span className="pc-marker">The premise</span>
                        <span className="tagpill pc-spoil warn">Spoilers veiled</span>
                      </div>
                      <h3 className="pc-title">{draft.title}</h3>
                      <p className="pc-prose">{emph(draft.premise)}</p>
                      <div className="pc-meta">
                        {draft.region && <span className="chip">{draft.region}</span>}
                        <span className="chip">{SCOPES.find(s => s.v === scope)?.t || 'Short arc'}</span>
                        {(draft.tones || []).map((t, i) => <span className="chip" key={i}>{t}</span>)}
                      </div>
                    </div>

                    {draft.openingScene && (
                      <div className="scene-card">
                        <div className="scene-strip">
                          {draft.setting?.name && <span className="tagpill"><svg className="ic"><use href="#bc-pin" /></svg>{draft.setting.name}</span>}
                          {sceneSub && <span className="tagpill" style={{ fontStyle: 'normal' }}>{sceneSub}</span>}
                        </div>
                        <div className="scene-inner">
                          <p className="scene-dir">Opening scene — read aloud</p>
                          <p className="scene-prose"><span className="drop">{(draft.openingScene || '').trim().charAt(0)}</span>{emph((draft.openingScene || '').trim().slice(1))}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {thinking && <div className="turn op"><div className="who"><span className="orb">O</span></div><div className="body"><div className="thinking"><span className="d" /><span className="d" /><span className="d" /></div></div></div>}
              </div>

              <div className="composer">
                <div className="nudges">
                  <span className="nlbl">Nudge</span>
                  {NUDGES.map(n => (
                    <span className={`chip nudge${n.regen ? ' regen' : ''}`} key={n.k} onClick={() => !loading && refine({ nudge: n.k })}>
                      {n.regen && <Ic n="refresh" />}{n.label}
                    </span>
                  ))}
                </div>
                <div className="comp-field">
                  <textarea value={compInput} onChange={e => setCompInput(e.target.value)} disabled={loading}
                    onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendComposer() }}
                    placeholder="Tell Opus more, or change a detail of the draft…" />
                  <button className="btn primary comp-send" type="button" disabled={loading || !compInput.trim()} onClick={sendComposer}><Ic n="send" /></button>
                </div>
              </div>
            </section>

            {/* RIGHT RAIL */}
            <aside className="rail-col">
              <div className="rail">
                <div className="dpanel">
                  <div className="dphead"><Ic n="sliders" /><span className="t">The shape of it</span><span className="by"><span className="dot" />Set by Opus</span></div>
                  <div className="dpbody">
                    <div className="dial">
                      <div className="dl"><span className="k">Scope &amp; length</span></div>
                      <div className="seg">
                        {SCOPES.map(s => <button type="button" key={s.v} className={scope === s.v ? 'on' : ''} onClick={() => setScope(s.v)}>{s.t}</button>)}
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Genre &amp; tone</span></div>
                      <div className="chiprow">
                        {(tones.length ? tones : ['—']).map((t, i) => <span className={`chip${i === 0 ? ' on' : ''}`} key={i}>{t}</span>)}
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Setting</span></div>
                      <div className="setting-val">
                        <span className="pin"><Ic n="pin" /></span>
                        <span><span className="sv-t">{draft?.setting?.name || draft?.region || '—'}</span><br /><span className="sv-s">{sceneSub || draft?.region || ''}</span></span>
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Who starts beside you</span></div>
                      <div className="party">
                        <span className="pmem"><span className="av hero">{glyph}</span><span><span className="pn">{character?.first_name || charName || 'You'}</span> <span className="pr">you</span></span></span>
                        {party.map((p, i) => <span className="pmem" key={i}><span className="av ally">{p.charAt(0)}</span><span><span className="pn">{p}</span> <span className="pr">ally</span></span></span>)}
                        <button className="add-mem" type="button" onClick={() => setParty(p => [...p, 'Companion'])}><Ic n="plus" />Add a companion</button>
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Difficulty &amp; the DM</span></div>
                      <div className="toggle-row" style={{ marginBottom: 10 }}><span className={`tg${inheritSettings ? '' : ' off'}`} onClick={() => setInheritSettings(v => !v)} /><span className="tt">Inherit from Settings</span></div>
                      <div className="setting-val">
                        <span className="pin"><Ic n="shield" /></span>
                        <span><span className="sv-t">Challenging · measured</span><br /><span className="sv-s">death is possible · Opus narrates with restraint</span></span>
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Lines &amp; veils</span></div>
                      <button className="veil-btn" type="button" title="Content boundaries — coming soon">
                        <Ic n="eye-off" /><span className="vt">Content boundaries</span><span className="vc">default</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="dpanel plan-mini">
                  <div className="dphead"><Ic n="globe" /><span className="t">Campaign plan · forming</span></div>
                  <div className="dpbody">
                    <div className="pmrow"><span className="k">Region</span><span className="v">{draft?.region || '—'}</span></div>
                    <div className="pmrow"><span className="k">Locations</span><span className="v accent">{(draft?.locations || []).length} drafted</span></div>
                    <div className="pmrow"><span className="k">Named NPCs</span><span className="v accent">{(draft?.npcs || []).length}</span></div>
                    <div className="pmrow"><span className="k">The truth</span><span className="v veiled">behind a veil</span></div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* sticky commit */}
      {mode === 'compose' && (
        <div className="commit">
          <div className="inner">
            <span className="save"><Ic n="check" />Draft autosaved to {charName ? `${charName}'s` : 'your'} home</span>
            <span className="spacer" />
            <span className="ttl"><span className="tl">Your campaign</span><span className="tn">{draft?.title}</span></span>
            <button className="btn primary begin" type="button" disabled={loading || !draft} onClick={begin}><Ic n="play" />Begin the first session</button>
          </div>
        </div>
      )}

      {/* cinematic begin */}
      {cinema && (
        <div className={`cinema on${cinemaRun ? ' run' : ''}`}>
          <div className="cin-eyebrow">Session 1 · {draft?.region || draft?.setting?.name}</div>
          <div className="cin-title">{draft?.title}</div>
          <div className="cin-line">{cinemaLine}</div>
          <div className="cin-status"><span className="thinking"><span className="d" /><span className="d" /><span className="d" /></span>Opus is setting the scene</div>
          <button className="cin-skip" type="button" onClick={() => onBegun && onBegun()}>Skip →</button>
        </div>
      )}
    </div>
  )
}

function BCSprite() {
  const s = { strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none', stroke: 'currentColor' }
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <symbol id="bc-arrow-left" viewBox="0 0 24 24" {...s}><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
      <symbol id="bc-refresh" viewBox="0 0 24 24" {...s}><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></symbol>
      <symbol id="bc-send" viewBox="0 0 24 24" {...s}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></symbol>
      <symbol id="bc-sliders" viewBox="0 0 24 24" {...s}><line x1="21" y1="4" x2="14" y2="4" /><line x1="10" y1="4" x2="3" y2="4" /><line x1="21" y1="12" x2="12" y2="12" /><line x1="8" y1="12" x2="3" y2="12" /><line x1="21" y1="20" x2="16" y2="20" /><line x1="12" y1="20" x2="3" y2="20" /><line x1="14" y1="2" x2="14" y2="6" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="16" y1="18" x2="16" y2="22" /></symbol>
      <symbol id="bc-globe" viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></symbol>
      <symbol id="bc-pin" viewBox="0 0 24 24" {...s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></symbol>
      <symbol id="bc-plus" viewBox="0 0 24 24" {...s}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
      <symbol id="bc-shield" viewBox="0 0 24 24" {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></symbol>
      <symbol id="bc-eye-off" viewBox="0 0 24 24" {...s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></symbol>
      <symbol id="bc-check" viewBox="0 0 24 24" {...s}><polyline points="20 6 9 17 4 12" /></symbol>
      <symbol id="bc-play" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4" /></symbol>
    </defs></svg>
  )
}
