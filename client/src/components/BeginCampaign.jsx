import { useState } from 'react'
import '../styles/hearth.css'
import '../styles/hearth-begincampaign.css'

/**
 * Begin a new Campaign — the conversational atelier where Opus authors the
 * world while the player sets the mood (design_handoff_hearth_app/Begin
 * Campaign.html). Two states: a Greeting (a free-text prompt + character-
 * grounded seeds) and a Compose atelier (manuscript dialogue thread + a living
 * premise/scene preview + a rail of dials), ending in a cinematic "Begin the
 * first session" that drops into the cockpit.
 *
 * Campaign creation is ALWAYS scoped to the character you entered through
 * (reached from that character's Campaigns screen) — there is no character/
 * world choice. Seeds are grounded in the strongest thread on the character
 * sheet (their background / calling) and name the thread they pulled from.
 *
 * Wired to the real backend: POST /api/campaign/draft (Opus authors/refines the
 * draft) and POST /api/campaign/begin (creates the campaign + plan, links the
 * character, persists the table's lines & veils). On Begin, /api/dm-session/start
 * runs under the cinematic so the player lands directly in the live session.
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
const SCOPES = [{ v: 'one', t: 'One-shot' }, { v: 'arc', t: 'Short arc' }, { v: 'open', t: 'Ongoing campaign' }]

// Rail genre/tone palette (grouped, multi-select). The premise card still shows
// Opus's own tone words; these dials let the player retune the leanings.
const GENRE_OPTIONS = ['Mystery', 'Survival', 'Horror', 'Heroic', 'Intrigue', 'Exploration', 'Heist', 'Warfare']
const TONE_OPTIONS = ['Quiet dread', 'Grim', 'Hopeful', 'Whimsical', 'Epic', 'Gritty', 'Bittersweet']

// Lines & veils — the table's content boundaries (open = shown · veil = off the
// page · line = never appears). Defaults mirror the design reference.
const CB_DEFAULTS = [
  { topic: 'Graphic violence & gore', state: 'veil' },
  { topic: 'Character death', state: 'open' },
  { topic: 'Harm to children', state: 'line' },
  { topic: 'Torture', state: 'veil' },
  { topic: 'Romance & intimacy', state: 'open' },
  { topic: 'Substance & addiction', state: 'open' },
  { topic: 'Body horror', state: 'open' },
  { topic: 'Slurs & discrimination', state: 'open' }
]
const CB_STATES = ['open', 'veil', 'line']

const Ic = ({ n }) => <svg className="ic"><use href={`#bc-${n}`} /></svg>

// Render Opus's *asterisk* emphasis as italic <em>.
function emph(text) {
  if (!text) return null
  return String(text).split(/\*([^*]+)\*/g).map((p, i) => (i % 2 === 1 ? <em key={i}>{p}</em> : p))
}

const lc = s => String(s ?? '').trim().toLowerCase()
const titleCase = s => String(s ?? '').replace(/\b\w/g, c => c.toUpperCase())

// Split Opus's flat tone list into the rail's Genre / Tone groups.
function splitTones(list) {
  const g = [], t = []
  ;(list || []).forEach(x => {
    const gi = GENRE_OPTIONS.findIndex(o => lc(o) === lc(x))
    const ti = TONE_OPTIONS.findIndex(o => lc(o) === lc(x))
    if (gi >= 0) g.push(GENRE_OPTIONS[gi])
    else if (ti >= 0) t.push(TONE_OPTIONS[ti])
    else if (String(x ?? '').trim()) g.push(String(x).trim())
  })
  return { g, t }
}
// Palette = the fixed options plus any selected value Opus invented.
function unionOpts(base, selected) {
  return [...base, ...selected.filter(s => !base.some(b => lc(b) === lc(s)))]
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
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [turns, setTurns] = useState([])             // { type:'opus'|'you', text, label? }
  const [thinking, setThinking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [compInput, setCompInput] = useState('')
  // rail dials (seeded by Opus; player-tunable)
  const [scope, setScope] = useState('arc')
  const [genres, setGenres] = useState([])
  const [tones, setTones] = useState([])
  // Opus-coined genre/tone words not in the fixed palette (e.g. "Melancholy").
  // Tracked separately from the selection so a coined chip STAYS in the palette
  // when toggled off — deselected means it won't shape the campaign, but it's
  // still re-pickable, instead of vanishing irrecoverably.
  const [inventedGenres, setInventedGenres] = useState([])
  const [inventedTones, setInventedTones] = useState([])
  const [toneOpen, setToneOpen] = useState(false)
  const [settingOpen, setSettingOpen] = useState(false)
  const [settingName, setSettingName] = useState('')
  const [settingDesc, setSettingDesc] = useState('')
  const [inheritSettings, setInheritSettings] = useState(true)
  const [boundaries, setBoundaries] = useState(() => CB_DEFAULTS.map(b => ({ ...b })))
  const [cbOpen, setCbOpen] = useState(false)
  // cinematic
  const [cinema, setCinema] = useState(false)
  const [cinemaRun, setCinemaRun] = useState(false)

  const subjectId = character?.id || null
  const charName = character ? (character.name || [character.first_name, character.last_name].filter(Boolean).join(' ') || 'your character') : null
  const firstName = character?.first_name || (charName ? charName.split(' ')[0] : 'your hero')
  const glyph = (character?.glyph || character?.first_name || character?.name || '?').charAt(0).toUpperCase()

  // The strongest narrative thread on the sheet the grounded seed pulls from.
  const threadKind = character?.background ? 'background' : (character?.subclass ? 'path' : 'calling')
  const threadLabel = titleCase(character?.background || character?.subclass || character?.class_label || character?.class || 'past')

  const toneSummary = [...genres, ...tones]
  const boundaryCount = boundaries.filter(b => b.state !== 'open').length

  // Sync the rail dials from a freshly drafted/refined campaign (Opus is
  // authoritative — the rail reads "Set by Opus" and updates live).
  const applyDraft = (d) => {
    setDraft(d)
    setScope(d.scope || 'arc')
    const { g, t } = splitTones(d.tones)
    setGenres(g); setTones(t)
    setInventedGenres(g.filter(x => !GENRE_OPTIONS.some(o => lc(o) === lc(x))))
    setInventedTones(t.filter(x => !TONE_OPTIONS.some(o => lc(o) === lc(x))))
    setSettingName(d.setting?.name || d.region || '')
    setSettingDesc(d.setting?.sub || '')
  }

  // ── draft generation ──────────────────────────────────────────────────────
  const beginWithOpus = async ({ promptOverride, seedOverride } = {}) => {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const d = await callDraft({
        prompt: promptOverride ?? prompt,
        subject: subjectId, seed: seedOverride || null,
        characterId: subjectId,
        dials: { scope, tones: toneSummary }
      })
      applyDraft(d)
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
      const d = await callDraft({ priorDraft: draft, nudge: nudge || null, userNote: userNote || null, characterId: subjectId, subject: subjectId })
      applyDraft(d)
      setTurns(t => [...t, { type: 'opus', text: d.opusMessage || '' }])
    } catch (e) { setError(e.message) } finally { setThinking(false); setLoading(false) }
  }

  const sendComposer = () => { const v = compInput.trim(); if (v && !loading) refine({ userNote: v }) }

  // ── rail editors ──────────────────────────────────────────────────────────
  const toggleIn = (setFn) => (val) => setFn(prev => prev.some(x => lc(x) === lc(val)) ? prev.filter(x => lc(x) !== lc(val)) : [...prev, val])
  const toggleGenre = toggleIn(setGenres)
  const toggleTone = toggleIn(setTones)

  const saveSetting = () => {
    const n = settingName.trim() || 'Untitled region'
    const d = settingDesc.trim()
    setSettingName(n); setSettingDesc(d)
    // Patch the draft so the setting tile, premise region chip, and the
    // plan-forming Region row all update together.
    setDraft(prev => prev ? { ...prev, region: n, setting: { ...(prev.setting || {}), name: n, sub: d } } : prev)
    setSettingOpen(false)
  }
  const cancelSetting = () => {
    setSettingName(draft?.setting?.name || draft?.region || '')
    setSettingDesc(draft?.setting?.sub || '')
    setSettingOpen(false)
  }
  const reimagineSetting = () => {
    if (loading) return
    setSettingOpen(false)
    refine({ userNote: 'Reimagine the setting — give the campaign a different region and place name, keeping the premise and tone we have.' })
  }

  const setBoundary = (topic, state) => setBoundaries(prev => prev.map(b => b.topic === topic ? { ...b, state } : b))

  // ── commit ──────────────────────────────────────────────────────────────
  const begin = async () => {
    if (loading || !draft || !subjectId) {
      if (!subjectId) setError('Select a character before beginning a campaign.')
      return
    }
    // Honour the rail's player edits in the committed campaign.
    const committed = { ...draft, scope, tones: toneSummary.length ? toneSummary : (draft.tones || []) }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/campaign/begin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: committed, characterId: subjectId, linesAndVeils: boundaries })
      })
      if (!res.ok) { let m = ''; try { m = (await res.json()).error } catch {} throw new Error(m || 'Could not begin the campaign.') }
      // Cinematic plays while Opus sets the opening scene (the /start call).
      setCinema(true)
      requestAnimationFrame(() => setCinemaRun(true))
      const startReq = fetch('/api/dm-session/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: subjectId, providerPreference: 'auto' })
      }).catch(() => {}) // if start fails, we still land on the (Hearth) session setup
      await Promise.all([startReq, new Promise(r => setTimeout(r, 3600))])
      onBegun && onBegun()
    } catch (e) { setError(e.message); setLoading(false); setCinema(false); setCinemaRun(false) }
  }

  // ── collaborative conversation ("Build it together") ──────────────────────
  // Opus talks WITH the player, asking questions, until they choose to draft.
  const startCollaboration = async ({ promptOverride } = {}) => {
    const seedText = (promptOverride ?? prompt).trim()
    if (!seedText || loading) return
    setMode('converse'); setError(null)
    setTurns([{ type: 'you', label: 'You', text: seedText }])
    setLoading(true)
    try {
      const res = await fetch('/api/campaign/converse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: seedText, conversation: [], characterId: subjectId, subject: subjectId })
      })
      if (!res.ok) { let m = ''; try { m = (await res.json()).error } catch {} throw new Error(m || 'Opus could not reply.') }
      const { opusMessage } = await res.json()
      setTurns(t => [...t, { type: 'opus', text: opusMessage || '' }])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const converseSend = async () => {
    const v = compInput.trim()
    if (!v || loading) return
    setCompInput('')
    const next = [...turns, { type: 'you', label: 'You', text: v }]
    setTurns(next)
    setLoading(true); setThinking(true); setError(null)
    try {
      const conversation = next.map(t => ({ role: t.type === 'opus' ? 'opus' : 'player', text: t.text }))
      const res = await fetch('/api/campaign/converse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation, characterId: subjectId, subject: subjectId })
      })
      if (!res.ok) { let m = ''; try { m = (await res.json()).error } catch {} throw new Error(m || 'Opus could not reply.') }
      const { opusMessage } = await res.json()
      setTurns(t => [...t, { type: 'opus', text: opusMessage || '' }])
    } catch (e) { setError(e.message) } finally { setLoading(false); setThinking(false) }
  }

  const draftFromConversation = async () => {
    if (loading || !turns.length) return
    setLoading(true); setThinking(true); setError(null)
    try {
      const conversation = turns.map(t => ({ role: t.type === 'opus' ? 'opus' : 'player', text: t.text }))
      const d = await callDraft({ conversation, characterId: subjectId, subject: subjectId, dials: { scope, tones: toneSummary } })
      applyDraft(d)
      setTurns(t => [...t, { type: 'opus', text: d.opusMessage || '' }])
      setMode('compose')
    } catch (e) { setError(e.message) } finally { setLoading(false); setThinking(false) }
  }

  // ── quick start (surprise me — minimal dials, no premise box) ──────────────
  const startQuickstart = () => { setError(null); setMode('quickstart') }
  const generateQuickstart = async () => {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const d = await callDraft({ prompt: null, seed: 'surprise', characterId: subjectId, subject: subjectId, dials: { scope, tones: toneSummary } })
      applyDraft(d)
      setTurns([{ type: 'opus', text: d.opusMessage || '' }])
      setMode('compose')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const resetToGreet = () => { setMode('greet'); setDraft(null); setTurns([]); setError(null) }

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
          {mode !== 'greet' && (
            <button className="restart" type="button" onClick={resetToGreet}>
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
              <div className="greet-op">
                <span className="orb">O</span><span className="lbl">Opus</span>
                {character && (
                  <span className="for-char"><span className="crestmini">{glyph}</span>Creating for <b>{charName}</b></span>
                )}
              </div>
              <h2>Every campaign begins as a single sentence. Tell me yours.</h2>
              <p className="askp">Give me a mood, a place, a wound {firstName} still carries — and I'll ask a few questions so we can shape it together before I write a word. <em>You set the weather. We'll find the storm.</em></p>

              <p className="glabel">What do you want to play?</p>
              <div className="prompt-wrap">
                <textarea className="prompt-box" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={loading}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && prompt.trim()) startCollaboration() }}
                  placeholder="A rain-soaked political mystery in a sinking canal city… a slow horror in a town that's forgotten how to grieve… or just a word: revenge, pilgrimage, heist." />
                <button className="btn primary prompt-send" type="button" disabled={loading || !prompt.trim()} onClick={() => startCollaboration()}>
                  <Ic n="send" />{loading ? 'Opus is writing…' : 'Build it together'}
                </button>
              </div>

              <p className="glabel">Or start another way</p>
              <div className="seed-row">
                <button className="seedc" type="button" disabled={loading}
                  onClick={() => startCollaboration({ promptOverride: `Build this campaign from the strongest thread on ${firstName}'s sheet — their ${threadKind} as ${threadLabel} — and the unfinished business, the people, and the places it left behind.` })}>
                  <span className="stag"><span className="dot" />From your {threadKind} · {threadLabel}</span>
                  <h4>The thread you still carry</h4>
                  <p>We'll build a campaign together from your {threadKind} as {threadLabel} — the debt, the person, or the place it left unfinished.</p>
                </button>
                <button className="seedc" type="button" disabled={loading} onClick={startQuickstart}>
                  <span className="stag"><span className="dot" />Quick start</span>
                  <h4>Surprise me</h4>
                  <p>Skip the conversation. Just pick the length, the genre &amp; tone, and the table's boundaries — I'll conjure the rest.</p>
                </button>
              </div>
            </div>
          </section>
        ) : mode === 'converse' ? (
          /* ─────────── COLLABORATE (open conversation) ─────────── */
          <section className="greet" style={{ display: 'block' }}>
            <div className="greet-hero" style={{ maxWidth: 760 }}>
              <div className="greet-op">
                <span className="orb">O</span><span className="lbl">Opus</span>
                {character && (<span className="for-char"><span className="crestmini">{glyph}</span>Building with <b>{charName}</b></span>)}
              </div>
              <h2>Let's build it together.</h2>
              <p className="askp">Answer as much or as little as you like — I'll ask a few things to find the shape of it. When it feels right, <em>draft it</em> and we'll watch the world take form.</p>

              <div className="thread" style={{ marginTop: 10 }}>
                {turns.map((t, i) => t.type === 'opus' ? (
                  <div className="turn op" key={i}>
                    <div className="who"><span className="orb">O</span></div>
                    <div className="body"><div className="speaker">Opus</div><div className="prose">{emph(t.text)}</div></div>
                  </div>
                ) : (
                  <div className="turn you" key={i}>
                    <div className="you-note"><span className="yl">{t.label || 'You'}</span>{t.text}</div>
                  </div>
                ))}
                {thinking && <div className="turn op"><div className="who"><span className="orb">O</span></div><div className="body"><div className="thinking"><span className="d" /><span className="d" /><span className="d" /></div></div></div>}
              </div>

              <div className="composer">
                <div className="comp-field">
                  <textarea value={compInput} onChange={e => setCompInput(e.target.value)} disabled={loading}
                    onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') converseSend() }}
                    placeholder="Answer Opus, or add a thought…" />
                  <button className="btn primary comp-send" type="button" disabled={loading || !compInput.trim()} onClick={converseSend}><Ic n="send" /></button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="btn primary" type="button" disabled={loading || !turns.length} onClick={draftFromConversation}>
                    <Ic n="check" />{loading ? 'Opus is writing…' : 'Draft it from our conversation'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : mode === 'quickstart' ? (
          /* ─────────── QUICK START (surprise me) ─────────── */
          <section className="greet" style={{ display: 'block' }}>
            <div className="greet-hero" style={{ maxWidth: 720 }}>
              <div className="greet-op">
                <span className="orb">O</span><span className="lbl">Opus</span>
                {character && (<span className="for-char"><span className="crestmini">{glyph}</span>Creating for <b>{charName}</b></span>)}
              </div>
              <h2>Quick start. Set the dials — I'll conjure the rest.</h2>
              <p className="askp">No premise needed. Choose the length, the leanings, and the table's boundaries; I'll surprise you with a world that fits, and you can shape it from there.</p>

              <p className="glabel">Campaign length</p>
              <div className="seg" style={{ maxWidth: 440 }}>
                {SCOPES.map(s => <button type="button" key={s.v} className={scope === s.v ? 'on' : ''} onClick={() => setScope(s.v)}>{s.t}</button>)}
              </div>

              <p className="glabel" style={{ marginTop: 22 }}>Genre &amp; tone</p>
              <div className="de-group">
                <div className="de-glabel">Genre</div>
                <div className="chiprow">
                  {GENRE_OPTIONS.map(g => (
                    <span className={`chip${genres.some(x => lc(x) === lc(g)) ? ' on' : ''}`} key={g} onClick={() => !loading && toggleGenre(g)}>{g}</span>
                  ))}
                </div>
              </div>
              <div className="de-group" style={{ marginTop: 12 }}>
                <div className="de-glabel">Tone</div>
                <div className="chiprow">
                  {TONE_OPTIONS.map(t => (
                    <span className={`chip${tones.some(x => lc(x) === lc(t)) ? ' on' : ''}`} key={t} onClick={() => !loading && toggleTone(t)}>{t}</span>
                  ))}
                </div>
              </div>

              <p className="glabel" style={{ marginTop: 22 }}>Content boundaries</p>
              <button className="veil-btn" type="button" onClick={() => setCbOpen(true)} style={{ maxWidth: 440 }}>
                <Ic n="eye-off" /><span className="vt">Lines &amp; veils for the table</span><span className="vc">{boundaryCount} set</span>
              </button>

              <div style={{ marginTop: 26 }}>
                <button className="btn primary prompt-send" type="button" disabled={loading} onClick={generateQuickstart}>
                  <Ic n="send" />{loading ? 'Opus is writing…' : 'Generate my campaign'}
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
                      <div className="dl"><span className="k">Genre &amp; tone</span>
                        <button className="edit" type="button" onClick={() => setToneOpen(o => !o)}>{toneOpen ? 'Done' : 'Change'}</button>
                      </div>
                      <div className="chiprow">
                        {(toneSummary.length ? toneSummary : ['—']).map((t, i) => <span className="chip on" key={i}>{t}</span>)}
                      </div>
                      <div className={`dial-edit${toneOpen ? ' open' : ''}`}>
                        <div className="de-hint">Lit chips shape the campaign and are sent to Opus. <span className="coined-mark">✦</span> marks words Opus coined — they count the same; tap to dim, tap again to relight.</div>
                        <div className="de-group">
                          <div className="de-glabel">Genre</div>
                          <div className="chiprow">
                            {unionOpts(GENRE_OPTIONS, [...inventedGenres, ...genres]).map(g => {
                              const coined = !GENRE_OPTIONS.some(o => lc(o) === lc(g))
                              return (
                                <span
                                  className={`chip${genres.some(x => lc(x) === lc(g)) ? ' on' : ''}${coined ? ' coined' : ''}`}
                                  key={g}
                                  title={coined ? `“${g}” is Opus's own word — it still shapes the campaign when lit` : undefined}
                                  onClick={() => !loading && toggleGenre(g)}
                                >{coined ? `✦ ${g}` : g}</span>
                              )
                            })}
                          </div>
                        </div>
                        <div className="de-group">
                          <div className="de-glabel">Tone</div>
                          <div className="chiprow">
                            {unionOpts(TONE_OPTIONS, [...inventedTones, ...tones]).map(t => {
                              const coined = !TONE_OPTIONS.some(o => lc(o) === lc(t))
                              return (
                                <span
                                  className={`chip${tones.some(x => lc(x) === lc(t)) ? ' on' : ''}${coined ? ' coined' : ''}`}
                                  key={t}
                                  title={coined ? `“${t}” is Opus's own word — it still shapes the campaign when lit` : undefined}
                                  onClick={() => !loading && toggleTone(t)}
                                >{coined ? `✦ ${t}` : t}</span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Setting</span>
                        <button className="edit" type="button" onClick={() => (settingOpen ? cancelSetting() : setSettingOpen(true))}>{settingOpen ? 'Close' : 'Edit'}</button>
                      </div>
                      <div className="setting-val">
                        <span className="pin"><Ic n="pin" /></span>
                        <span><span className="sv-t">{draft?.setting?.name || draft?.region || '—'}</span><br /><span className="sv-s">{sceneSub || draft?.region || ''}</span></span>
                      </div>
                      <div className={`dial-edit${settingOpen ? ' open' : ''}`}>
                        <input className="set-input" value={settingName} onChange={e => setSettingName(e.target.value)} placeholder="Region name" />
                        <input className="set-input" value={settingDesc} onChange={e => setSettingDesc(e.target.value)} placeholder="a short evocative descriptor" />
                        <div className="de-actions">
                          <button className="opus-redo" type="button" disabled={loading} onClick={reimagineSetting}><Ic n="refresh" />Let Opus reimagine</button>
                          <span className="spacer" />
                          <button className="btn sm" type="button" onClick={cancelSetting}>Cancel</button>
                          <button className="btn primary sm" type="button" onClick={saveSetting}>Save</button>
                        </div>
                      </div>
                    </div>

                    <div className="dial">
                      <div className="dl"><span className="k">Your party</span></div>
                      <div className="party">
                        <span className="pmem"><span className="av self">{glyph}</span><span><span className="pn">{firstName}</span> <span className="pr">you</span></span></span>
                      </div>
                      <p className="party-note">You set out alone — companions join as the story finds them.</p>
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
                      <div className="dl"><span className="k">Content boundaries</span></div>
                      <button className="veil-btn" type="button" onClick={() => setCbOpen(true)}>
                        <Ic n="eye-off" /><span className="vt">Lines &amp; veils for the table</span><span className="vc">{boundaryCount} set</span>
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

      {/* content boundaries modal */}
      {cbOpen && (
        <div className="scrim" onClick={e => { if (e.target === e.currentTarget) setCbOpen(false) }}>
          <div className="modal cb">
            <div className="modal-head"><h3>Content boundaries</h3></div>
            <div className="modal-body">
              <p className="cb-sub">Tell Opus what your table will and won't put on the page. Change these any time during play.</p>
              <div className="cb-legend">
                <span className="lo"><b>Open</b> — shown in full</span>
                <span className="lv"><b>Veil</b> — happens off the page</span>
                <span className="ll"><b>Line</b> — never appears</span>
              </div>
              <div className="cb-list">
                {boundaries.map(b => (
                  <div className="cb-row" key={b.topic}>
                    <span className="cb-t">{b.topic}</span>
                    <div className="cb-seg">
                      {CB_STATES.map(s => (
                        <button type="button" key={s} data-s={s} className={b.state === s ? 'on' : ''} onClick={() => setBoundary(b.topic, s)}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <span className="foot-note">{boundaryCount} {boundaryCount === 1 ? 'boundary' : 'boundaries'} set</span>
              <button className="btn" type="button" onClick={() => setCbOpen(false)}>Cancel</button>
              <button className="btn primary" type="button" onClick={() => setCbOpen(false)}>Done</button>
            </div>
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
