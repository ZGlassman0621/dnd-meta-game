import { useState, useEffect } from 'react'
import CompanionSheet from './CompanionSheet'
import PartyBuilder from './PartyBuilder'
import '../styles/hearth.css'
import '../styles/hearth-companions.css'

/* ───────────────────────── Hearth · Companions ─────────────────────────
   Faithful build of Hearth/Companions.html: the dark-editorial roster of
   "those travelling with you". Pure presentation swap — all companion
   data, fetching, recruiting, dismissing and the XP-progress maths are
   preserved from the original CompanionsPage. Card fields are wired to the
   real companion record; anything the record doesn't carry (concentration
   flags, a written bio) is omitted rather than faked. Styles live in
   hearth.css (shared) + hearth-companions.css (this screen).
   ──────────────────────────────────────────────────────────────────── */

// XP thresholds for each level (same as character progression)
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
]

// ── local icon sprite (paths copied from the design's icon defs) ──
const HSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
  </defs></svg>
)
const Ic = ({ n }) => <svg className="ic"><use href={'#i-' + n} /></svg>

// ── small helpers ──
const cap = (s) => (s == null || s === '') ? s : String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const monogram = (name) => (name || '?').trim().charAt(0).toUpperCase()
const hpKind = (cur, max) => { const r = max ? cur / max : 1; return r > 0.5 ? '' : r > 0.25 ? 'warn' : 'bad' }
const pct = (cur, max) => max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 100
const parseJson = (v, dflt) => { if (v == null) return dflt; if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return dflt } }

// the original card's display name (handles a nickname infixed into the full name)
const displayName = (c) => (c.nickname && c.name)
  ? `${c.name.split(' ')[0]} "${c.nickname}" ${c.name.split(' ').slice(1).join(' ')}`.trim()
  : (c.name || c.nickname || 'A companion')

function CompanionsPage({ character, onCharacterUpdated, onBack }) {
  const [companions, setCompanions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCompanion, setSelectedCompanion] = useState(null)
  const [showPartyBuilder, setShowPartyBuilder] = useState(false)
  const [showRecruitModal, setShowRecruitModal] = useState(false)
  const [availableNpcs, setAvailableNpcs] = useState([])
  const [npcToRecruit, setNpcToRecruit] = useState(null)

  const campaignConfig = character.campaign_config
    ? JSON.parse(character.campaign_config)
    : {}

  useEffect(() => {
    if (character?.id) {
      fetchCompanions()
    }
  }, [character?.id])

  const fetchCompanions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/companion/character/${character.id}`)
      if (!response.ok) throw new Error('Failed to fetch companions')
      const data = await response.json()
      setCompanions(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableNpcs = async () => {
    try {
      const response = await fetch(`/api/companion/available/${character.id}`)
      if (!response.ok) throw new Error('Failed to fetch available NPCs')
      const data = await response.json()
      setAvailableNpcs(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDismiss = async (companionId) => {
    if (!confirm('Are you sure you want to dismiss this companion?')) return

    try {
      const response = await fetch(`/api/companion/${companionId}/dismiss`, {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to dismiss companion')
      }

      await fetchCompanions()
      setSelectedCompanion(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCompanionUpdate = async () => {
    await fetchCompanions()
  }

  const handlePartyMemberCreated = async () => {
    setShowPartyBuilder(false)
    setNpcToRecruit(null)
    await fetchCompanions()
  }

  const openRecruitModal = async () => {
    await fetchAvailableNpcs()
    setShowRecruitModal(true)
  }

  // Calculate XP progress for a companion
  const getXpProgress = (companion) => {
    const currentXp = companion.companion_experience || 0
    const level = companion.companion_level || 1
    const currentLevelXp = XP_THRESHOLDS[level - 1] || 0
    const nextLevelXp = XP_THRESHOLDS[level] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1]
    const xpInCurrentLevel = currentXp - currentLevelXp
    const xpNeededForLevel = nextLevelXp - currentLevelXp
    const progress = level >= 20 ? 100 : (xpInCurrentLevel / xpNeededForLevel) * 100

    return {
      currentXp,
      nextLevelXp,
      xpToNext: nextLevelXp - currentXp,
      progress: Math.min(100, Math.max(0, progress)),
      isMaxLevel: level >= 20
    }
  }

  const activeCompanions = companions.filter(c => c.status === 'active')
  const MAX_PARTY_SIZE = 12
  const canAddMore = activeCompanions.length < MAX_PARTY_SIZE

  // Determine if "Create Party Member" should be shown based on campaign type
  const showCreateButton = !campaignConfig ||
    !['saga', 'ongoing'].includes(campaignConfig.campaign_length)

  // back to the dashboard: CompanionsPage receives no onBack prop, so reach the
  // app's existing "Home" affordance (still mounted under this overlay) and
  // trigger it. Falls back to clearing the hash if that button isn't found.
  const goHome = () => {
    if (onBack) return onBack();
    const home = Array.from(document.querySelectorAll('header button'))
      .find(b => b.textContent.trim() === 'Home')
    if (home) home.click()
  }

  const charName = character?.nickname || character?.name || 'your'
  const countLabel = `${activeCompanions.length} companion${activeCompanions.length === 1 ? '' : 's'}`

  return (
    <div className="hearth companions">
      <HSprite />

      {/* ───────── HEADER ───────── */}
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <button className="back" onClick={goHome} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
          <Ic n="arrow-left" />{character?.name ? `${charName}'s home` : 'Home'}
        </button>
        <div className="spacer"></div>
        <span className="opus"><span className="dot"></span>Opus</span>
      </header>

      {/* ───────── PAGE ───────── */}
      <main className="page">
        <div className="page-eyebrow"><span className="eyebrow">Companions</span><span className="ln"></span></div>

        <div className="sec-head">
          <h2>Travelling with you</h2>
          <span className="glyph">❧</span>
          <span className="fl"></span>
          <span className="sub">{countLabel}</span>
          <div className="comp-actions">
            {showCreateButton && (
              <button
                className="btn ghost sm"
                onClick={() => setShowPartyBuilder(true)}
                disabled={!canAddMore}
                title={!canAddMore ? `Party limit reached (${MAX_PARTY_SIZE})` : 'Create a party member'}
              >
                <Ic n="plus" />New member
              </button>
            )}
            <button
              className="btn sm"
              onClick={openRecruitModal}
              disabled={!canAddMore}
              title={!canAddMore ? `Party limit reached (${MAX_PARTY_SIZE})` : 'Recruit an NPC'}
            >
              <Ic n="plus" />Recruit
            </button>
          </div>
        </div>

        <p className="comp-note">
          Companions aren't recruited from a menu — they join your story as you earn their trust in play.
          Each takes a place at the fire here.
        </p>

        {error && <div className="comp-error">{error}</div>}

        {loading ? (
          <p className="help" style={{ color: 'var(--ink-3)' }}>Gathering those at the fire…</p>
        ) : (
          <div className="comp-grid">
            {activeCompanions.map(companion => (
              <CompanionCard
                key={companion.id}
                companion={companion}
                xpProgress={getXpProgress(companion)}
                onClick={() => setSelectedCompanion(companion)}
              />
            ))}

            {/* one empty seat at the fire while there's still room */}
            {canAddMore && (
              <div className="comp empty">
                <div>
                  <div className="eg">❧</div>
                  <div className="et">An empty place at the fire — kept for whoever the story brings next.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Companion Detail Modal (unchanged behaviour) */}
      {selectedCompanion && (
        <CompanionSheet
          companion={selectedCompanion}
          onClose={() => setSelectedCompanion(null)}
          onDismiss={() => handleDismiss(selectedCompanion.id)}
          onUpdate={handleCompanionUpdate}
        />
      )}

      {/* Recruit Modal — Hearth-styled, same flow */}
      {showRecruitModal && (
        <div className="scrim" onClick={() => setShowRecruitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="eyebrow" style={{ marginBottom: 6 }}>An ally at the door</div>
              <h3>Recruit a companion</h3>
            </div>
            <div className="modal-body">
              <p className="help" style={{ marginTop: 0, marginBottom: 16 }}>
                Choose someone from your records. You'll set their class, abilities, and the rest next.
              </p>

              {availableNpcs.length === 0 ? (
                <p className="help" style={{ margin: 0, color: 'var(--ink-3)' }}>
                  No-one is ready to be recruited yet. NPCs must be marked "Companion Available"
                  in the NPC manager to appear here.
                </p>
              ) : (
                <div className="recruit-list">
                  {availableNpcs.map(npc => (
                    <button
                      key={npc.id}
                      className="recruit-row"
                      onClick={() => {
                        setNpcToRecruit(npc)
                        setShowRecruitModal(false)
                        setShowPartyBuilder(true)
                      }}
                    >
                      {npc.avatar
                        ? <img src={npc.avatar} alt={npc.name} />
                        : <span className="crest" style={{ width: 44, height: 44, borderRadius: 'var(--radius)' }}><span className="mono" style={{ fontSize: 20 }}>{monogram(npc.name)}</span></span>}
                      <span style={{ flex: 1 }}>
                        <span className="rr-name" style={{ display: 'block' }}>{npc.name}</span>
                        <span className="rr-meta" style={{ display: 'block' }}>
                          {[npc.race, npc.occupation].filter(Boolean).join(' · ') || 'Unknown'}
                        </span>
                      </span>
                      <span className="eyebrow" style={{ color: 'var(--accent)' }}>Choose</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowRecruitModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Party Builder Modal (unchanged behaviour) */}
      {showPartyBuilder && (
        <PartyBuilder
          characterId={character.id}
          characterLevel={character.level}
          prefillFromNpc={npcToRecruit}
          onComplete={handlePartyMemberCreated}
          onCancel={() => {
            setShowPartyBuilder(false)
            setNpcToRecruit(null)
          }}
        />
      )}
    </div>
  )
}

// ── Companion card · faithful to the design's `.comp` block ──
function CompanionCard({ companion, xpProgress, onClick }) {
  const isClassBased = companion.progression_type === 'class_based'

  // role line: race · class (subclass)  —or—  race · occupation
  const roleParts = []
  if (companion.race) roleParts.push(companion.race)
  if (isClassBased && companion.companion_class) {
    roleParts.push(cap(companion.companion_class) + (companion.companion_subclass ? ` (${companion.companion_subclass})` : ''))
  } else if (companion.occupation) {
    roleParts.push(companion.occupation)
  }

  // ability scores → mods, for the stat chips (only when we actually have them)
  const abil = parseJson(companion.companion_ability_scores || companion.npc_ability_scores, null)
  const mods = abil
    ? Object.entries({ STR: 'str', DEX: 'dex', CON: 'con', INT: 'int', WIS: 'wis', CHA: 'cha' })
        .map(([lbl, key]) => ({ lbl, val: Math.floor(((abil[key] ?? 10) - 10) / 2) }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 1) // lead with the companion's strongest ability, as the mockup does
    : []

  const curHp = companion.companion_current_hp
  const maxHp = companion.companion_max_hp
  const hasHp = isClassBased && Number.isFinite(curHp) && Number.isFinite(maxHp) && maxHp > 0
  // class-based companions carry their own `armor_class`; NPC-stat companions
  // surface the joined NPC `ac`. (Default-10 rows still read as a real value.)
  const ac = isClassBased ? companion.armor_class : companion.ac

  // a real "bio": motivation, else a personality trait, else nothing (no fake copy)
  const bio = companion.motivation || companion.personality_trait_1 || companion.personality_trait_2 || null

  return (
    <button type="button" className="comp" onClick={onClick}>
      {companion.avatar
        ? <span className="crest lg v"><img className="crest-img" src={companion.avatar} alt={companion.name} /></span>
        : <span className={`crest lg ${isClassBased ? '' : 'v'}`}><span className="mono">{monogram(companion.nickname || companion.name)}</span></span>}

      <div>
        <h3 className="cm-name">{displayName(companion)}</h3>
        {roleParts.length > 0 && (
          <div className="cm-role">
            {roleParts.map((p, i) => (
              <span key={i}>{i > 0 && <span className="sep">·</span>}{p}</span>
            ))}
          </div>
        )}

        <div className="cm-stats">
          {isClassBased && companion.companion_level != null && <span className="chip">L{companion.companion_level}</span>}
          {!hasHp && Number.isFinite(curHp) && Number.isFinite(maxHp) && maxHp > 0 && <span className="chip">HP {curHp}/{maxHp}</span>}
          {ac ? <span className="chip">AC {ac}</span> : null}
          {mods.map(m => <span key={m.lbl} className="chip">{m.lbl} {m.val >= 0 ? '+' : ''}{m.val}</span>)}
          {companion.cr ? <span className="chip">CR {companion.cr}</span> : null}
        </div>

        {hasHp && (
          <div className="cm-hp">
            <div className="cm-hp-row">
              <span className="cm-hp-l">Hit points</span>
              <span className="cm-hp-v">{curHp} / {maxHp}</span>
            </div>
            <div className={`hpbar ${hpKind(curHp, maxHp)}`}>
              <div className="fill" style={{ width: `${pct(curHp, maxHp)}%` }} />
            </div>
            <div className="cm-hp-row" style={{ marginTop: 8, marginBottom: 5 }}>
              <span className="cm-hp-l">Experience</span>
              <span className="cm-hp-v">
                {xpProgress.isMaxLevel ? 'Max level' : `${xpProgress.xpToNext.toLocaleString()} to next`}
              </span>
            </div>
            <div className="hpbar">
              <div className="fill" style={{ width: `${xpProgress.progress}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        )}

        {bio && <div className="cm-bio">{bio}</div>}

        <div className="cm-tags">
          {!isClassBased && <span className="chip">NPC companion</span>}
          {companion.occupation && isClassBased && <span className="chip">{companion.occupation}</span>}
        </div>
      </div>
    </button>
  )
}

export default CompanionsPage
