import { useState, useEffect } from 'react';
import '../styles/hearth.css';
import '../styles/hearth-campaign-plan.css';

/* ───────────────────────── Hearth · Campaign Plan ─────────────────────────
   Faithful build of Hearth/"Campaign Plan.html": a read-only world bible written
   by Opus. Plain content shows openly; spoilery/unseen details sit behind a blur
   "veil" so the player never spoils their own story. Pure presentation — all data
   fetching + generation logic is the original component's, preserved verbatim.
   Panels are wired to the real plan object; where the plan lacks a field the
   design shows, that piece is omitted rather than faked. Styles in
   hearth-campaign-plan.css.
   ──────────────────────────────────────────────────────────────────────── */

/* local icon sprite — symbol paths copied from the design's icon defs */
const HearthSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></symbol>
    <symbol id="i-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></symbol>
    <symbol id="i-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></symbol>
    <symbol id="i-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></symbol>
    <symbol id="i-scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h11a2 2 0 0 1 2 2v2H10V4a2 2 0 0 0-2-2z" /><path d="M19 6v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" /></symbol>
    <symbol id="i-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></symbol>
    <symbol id="i-coins" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" /></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></symbol>
    <symbol id="i-feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></symbol>
  </defs></svg>
);

const Ic = ({ n }) => <svg className="ic"><use href={`#i-${n}`} /></svg>;

/* inline blurred spoiler — gates the spoilery half of an otherwise-plain card */
function InlineSpoiler({ label, children }) {
  const [revealed, setRevealed] = useState(false);
  if (!children) return null;
  if (!revealed) {
    return (
      <div className="ispoiler">
        <button className="ireveal" onClick={() => setRevealed(true)}>
          <Ic n="eye-off" />Reveal {label}
        </button>
      </div>
    );
  }
  return (
    <div className="ispoiler">
      <button className="ihide" onClick={() => setRevealed(false)}>Hide {label}</button>
      <div className="ibody">{children}</div>
    </div>
  );
}

/* full-card spoiler — the whole card is veiled until revealed (unseen NPCs,
   antagonists, unvisited locations, the truth of the plot). */
function VeilCard({ revealLabel, accent, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`read spoiler${accent ? ' spoiler-card' : ''}${open ? ' open' : ''}`}>
      <div className="reveal" onClick={() => setOpen(true)}>
        <span className="rl"><Ic n="eye-off" />{revealLabel}</span>
      </div>
      <div className="veil">{children}</div>
    </div>
  );
}

const cap = (s) => (s == null || s === '') ? s : String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const ROLE_BLUE = new Set(['mentor', 'patron']);
const REL_CLASS = { ally: '', enemy: 'bad', neutral: 'warn', potential: 'warn' };

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'globe' },
  { key: 'main_quest', label: 'Main Quest', icon: 'flag' },
  { key: 'world', label: 'World State', icon: 'globe' },
  { key: 'timeline', label: 'World Timeline', icon: 'clock' },
  { key: 'npcs', label: 'NPCs', icon: 'users', count: (p) => p.npcs?.length },
  { key: 'companions', label: 'Companions', icon: 'users', count: (p) => p.potential_companions?.length },
  { key: 'locations', label: 'Locations', icon: 'pin', count: (p) => p.locations?.length },
  { key: 'merchants', label: 'Merchants', icon: 'coins', count: (p) => p.merchants?.length },
  { key: 'factions', label: 'Factions', icon: 'shield', count: (p) => p.factions?.length },
  { key: 'side_quests', label: 'Side Quests', icon: 'scroll', count: (p) => p.side_quests?.length },
  { key: 'dm_notes', label: "DM's Veil", icon: 'eye-off' }
];

const GENERATION_STEPS = [
  { label: 'Connecting to Claude Opus...', duration: 3000 },
  { label: 'Analyzing character backstory...', duration: 5000 },
  { label: 'Building world state & politics...', duration: 8000 },
  { label: 'Creating main quest arc...', duration: 10000 },
  { label: 'Generating NPCs & factions...', duration: 8000 },
  { label: 'Designing locations & side quests...', duration: 8000 },
  { label: 'Building world timeline...', duration: 6000 },
  { label: 'Finalizing campaign plan...', duration: 12000 }
];

export default function CampaignPlanPage({ character, onBack }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);
  const [genStep, setGenStep] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    if (character?.campaign_id) {
      loadPlan();
    } else {
      setLoading(false);
    }
  }, [character]);

  // Animated progress during generation
  useEffect(() => {
    if (!generating) {
      setGenStep(0);
      setGenProgress(0);
      return;
    }

    let totalElapsed = 0;
    const interval = setInterval(() => {
      totalElapsed += 200;

      // Find which step we're on based on cumulative duration
      let cumulative = 0;
      let currentStep = 0;
      for (let i = 0; i < GENERATION_STEPS.length; i++) {
        cumulative += GENERATION_STEPS[i].duration;
        if (totalElapsed < cumulative) {
          currentStep = i;
          break;
        }
        if (i === GENERATION_STEPS.length - 1) {
          currentStep = i;
        }
      }

      setGenStep(currentStep);

      // Overall progress (cap at 95% until actual completion)
      const totalDuration = GENERATION_STEPS.reduce((sum, s) => sum + s.duration, 0);
      const pct = Math.min(95, Math.round((totalElapsed / totalDuration) * 95));
      setGenProgress(pct);
    }, 200);

    return () => clearInterval(interval);
  }, [generating]);

  const loadPlan = async () => {
    try {
      const response = await fetch(`/api/campaign/${character.campaign_id}/plan`);
      const data = await response.json();
      setPlan(data);
    } catch (error) {
      console.error('Error loading plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/campaign/${character.campaign_id}/plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: character.id })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate plan');
      }

      const data = await response.json();
      setPlan(data);
    } catch (error) {
      console.error('Error generating plan:', error);
      setError(error.message);
    } finally {
      setGenerating(false);
    }
  };

  /* shared header chrome — wordmark + Opus badge. No back link: this component
     is mounted under the app's global NavigationMenu, which owns navigation, and
     no onBack handler is passed, so we don't fake one. */
  const Header = () => (
    <header className="dash-hdr">
      <div className="wordmark">D<span className="amp">&amp;</span>D</div>
      <div className="vr"></div>
      <span className="back" onClick={onBack} style={{ cursor: 'pointer' }}><Ic n="book" />World bible</span>
      <div className="spacer"></div>
      <span className="opus"><span className="dot"></span>Opus</span>
    </header>
  );

  // ─── no campaign assigned ───────────────────────────────────────
  if (!character?.campaign_id) {
    return (
      <div className="hearth campaign-plan app-bg">
        <HearthSprite />
        <Header />
        <main className="page">
          <div className="plan-head"><h1>Campaign Plan</h1></div>
          <div className="plan-sub">View and manage your campaign's master plan.</div>
          <div className="panel" style={{ padding: '28px 30px' }}>
            <p className="empty-note">No campaign assigned. Please assign this character to a campaign first.</p>
          </div>
        </main>
      </div>
    );
  }

  // ─── loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="hearth campaign-plan app-bg">
        <HearthSprite />
        <Header />
        <main className="page">
          <div className="loading-note">Reading the world bible…</div>
        </main>
      </div>
    );
  }

  // ─── no plan yet (generate) ─────────────────────────────────────
  if (!plan) {
    return (
      <div className="hearth campaign-plan app-bg">
        <HearthSprite />
        <Header />
        <main className="page">
          <div className="panel gen-panel">
            <div className="opus" style={{ justifyContent: 'center', marginBottom: 14 }}><span className="dot"></span>Written by Opus</div>
            <h2>No world bible yet</h2>
            <p>
              Generate a living world with your character's backstory woven into the narrative.
              This uses Claude Opus for high-quality world building.
            </p>

            {error && <p className="err-line">{error}</p>}

            {!generating && (
              <button className="btn primary lg" onClick={generatePlan}><Ic n="feather" />Generate campaign plan</button>
            )}

            {generating && (
              <div className="gen-prog">
                <div className="gprow">
                  <span className="gpstep">{GENERATION_STEPS[genStep]?.label}</span>
                  <span className="gppct">{genProgress}%</span>
                </div>
                <div className="gptrack"><div className="fill" style={{ width: `${genProgress}%` }} /></div>
                <p className="gpcap">Claude Opus is crafting your living world…</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ─── tab panes ──────────────────────────────────────────────────
  const renderOverview = () => {
    const ws = plan.world_state || {};
    return (
      <div className="read-grid">
        <div className="read">
          <div className="marker"><Ic n="flag" />The campaign</div>
          <h3>{plan.main_quest?.title || 'Your adventure'}</h3>
          {plan.main_quest?.summary && (
            <InlineSpoiler label="the plot">
              <p>{plan.main_quest.summary}</p>
            </InlineSpoiler>
          )}
        </div>

        {plan.themes?.length > 0 && (
          <div className="read">
            <div className="marker"><Ic n="book" />Themes</div>
            <h3>What this story turns on</h3>
            <div className="tagline">
              {plan.themes.map((t, i) => <span key={i} className="chip">{t}</span>)}
            </div>
          </div>
        )}

        {ws.political_situation && (
          <div className="read">
            <div className="marker blue"><Ic n="globe" />The world</div>
            <h3>Where things stand</h3>
            <p>{ws.political_situation}</p>
          </div>
        )}

        {ws.major_threats?.length > 0 && (
          <VeilCard revealLabel="Reveal — the major threats" accent>
            <div className="marker spoiler-m"><Ic n="globe" />The stakes</div>
            <h3>If nothing is done</h3>
            <ul className="note">
              {ws.major_threats.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </VeilCard>
        )}

        {(plan.generated_at || plan.last_modified) && (
          <div className="read">
            <div className="marker"><Ic n="clock" />Provenance</div>
            <h3>Written by Opus</h3>
            {plan.generated_at && <p className="kv"><span className="k">Generated</span>{new Date(plan.generated_at).toLocaleString()}</p>}
            {plan.last_modified && plan.last_modified !== plan.generated_at && (
              <p className="kv"><span className="k">Revised</span>{new Date(plan.last_modified).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMainQuest = () => (
    <div className="read-grid single">
      <div className="read">
        <div className="marker"><Ic n="flag" />The main quest</div>
        <h3>{plan.main_quest?.title || 'Untitled quest'}</h3>
        {plan.main_quest?.summary && (
          <InlineSpoiler label="the summary"><p>{plan.main_quest.summary}</p></InlineSpoiler>
        )}
        {plan.main_quest?.hook && (
          <InlineSpoiler label="how it begins"><p>{plan.main_quest.hook}</p></InlineSpoiler>
        )}
        {plan.main_quest?.stakes && (
          <InlineSpoiler label="the stakes"><p>{plan.main_quest.stakes}</p></InlineSpoiler>
        )}
      </div>

      {plan.main_quest?.acts?.map((act, idx) => (
        <div className="read" key={idx}>
          <div className="marker"><span className="ord">Act {act.act_number}</span></div>
          <h3>{act.title}</h3>
          <InlineSpoiler label={`Act ${act.act_number}`}>
            {act.summary && <p>{act.summary}</p>}
            {act.key_locations?.length > 0 && (
              <p className="kv blue"><span className="k">Locations</span><span className="v">{act.key_locations.join(', ')}</span></p>
            )}
            {act.key_npcs?.length > 0 && (
              <p className="kv"><span className="k">NPCs</span>{act.key_npcs.join(', ')}</p>
            )}
            {act.potential_outcomes?.length > 0 && (
              <>
                <p className="kv"><span className="k">Potential outcomes</span></p>
                <ul className="note">{act.potential_outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </>
            )}
          </InlineSpoiler>
        </div>
      ))}
    </div>
  );

  const renderWorldState = () => {
    const ws = plan.world_state || {};
    return (
      <div className="read-grid">
        {ws.political_situation && (
          <div className="read">
            <div className="marker"><Ic n="globe" />The region</div>
            <h3>Political situation</h3>
            <p>{ws.political_situation}</p>
          </div>
        )}

        {ws.major_threats?.length > 0 && (
          <div className="read">
            <div className="marker"><Ic n="flag" />The stakes</div>
            <h3>Major threats</h3>
            <ul className="note">{ws.major_threats.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}

        {ws.faction_tensions?.length > 0 && (
          <div className="read">
            <div className="marker blue"><Ic n="users" />Who holds what</div>
            <h3>Faction tensions</h3>
            {ws.faction_tensions.map((t, i) => (
              <div key={i}>
                {i > 0 && <hr className="scene-sep" />}
                <p style={{ marginBottom: 4 }}><em>{t.factions?.join(' vs ')}</em></p>
                {t.nature && <p style={{ marginBottom: 4 }}>{t.nature}</p>}
                {t.current_state && <p className="italic">{t.current_state}</p>}
              </div>
            ))}
          </div>
        )}

        {ws.regional_news?.length > 0 && (
          <div className="read">
            <div className="marker blue"><Ic n="scroll" />Word on the road</div>
            <h3>Regional news</h3>
            <ul className="note">{ws.regional_news.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        )}
      </div>
    );
  };

  const renderTimeline = () => {
    const tl = plan.world_timeline || {};
    return (
      <div className="read-grid single">
        {(tl.description) && (
          <div className="read">
            <div className="marker"><Ic n="clock" />The living world</div>
            <h3>How the world turns</h3>
            <p>{tl.description}</p>
            <p className="italic">These events occur regardless of what the party does.</p>
          </div>
        )}

        {tl.events?.map((event, idx) => {
          const visClass = event.visibility === 'secret' ? 'bad' : event.visibility === 'rumored' ? 'warn' : '';
          const veiled = event.visibility === 'secret';
          const Body = (
            <>
              <div className={`marker${veiled ? ' spoiler-m' : ''}`}>
                <span className="ord">World event {idx + 1}</span>
              </div>
              <h3>{event.title}</h3>
              {event.visibility && <span className={`chip ${visClass}`} style={{ marginBottom: 9 }}>{event.visibility}</span>}
              {event.timing && <p className="kv"><span className="k">Timing</span>{event.timing}</p>}
              {event.description && <p>{event.description}</p>}
              {event.consequences_if_ignored && (
                <p className="kv"><span className="k">If ignored</span>{event.consequences_if_ignored}</p>
              )}
            </>
          );
          return veiled ? (
            <VeilCard key={event.id || idx} revealLabel={`Reveal world event ${idx + 1}`} accent>{Body}</VeilCard>
          ) : (
            <div className="read" key={event.id || idx}>{Body}</div>
          );
        })}
      </div>
    );
  };

  const renderNPCs = () => (
    <div className="read-grid">
      {plan.npcs?.map((npc, idx) => {
        const blue = ROLE_BLUE.has(npc.role);
        return (
          <div className="read" key={npc.id || idx}>
            <div className={`marker${blue ? ' blue' : ''}`}><Ic n="users" />{npc.from_backstory ? 'From your past' : 'Of this world'}</div>
            <h3>{npc.name}</h3>
            {npc.description && <p>{npc.description}</p>}
            {npc.location && <p className="kv blue"><span className="k">Found at</span><span className="v">{npc.location}</span></p>}
            <div className="tagline">
              {npc.from_backstory && <span className="chip">backstory</span>}
              {npc.role && <span className="chip">{cap(npc.role)}</span>}
            </div>
            {(npc.motivation || npc.secrets?.length > 0) && (
              <InlineSpoiler label="role & secrets">
                {npc.motivation && <p className="kv"><span className="k">Motivation</span>{npc.motivation}</p>}
                {npc.secrets?.length > 0 && (
                  <>
                    <p className="kv"><span className="k">Secrets</span></p>
                    <ul className="note">{npc.secrets.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </>
                )}
              </InlineSpoiler>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderCompanions = () => (
    <div className="read-grid">
      {plan.potential_companions?.map((c, idx) => (
        <div className="read" key={c.id || idx}>
          <div className="marker blue"><Ic n="users" />Could travel with you</div>
          <h3>{c.name}</h3>
          {(c.race || c.class) && <div className="tagline"><span className="chip">{[c.race, c.class].filter(Boolean).join(' ')}</span></div>}
          {c.personality && <p style={{ marginTop: 12 }}>{c.personality}</p>}
          {c.motivation && <p className="kv"><span className="k">Motivation</span>{c.motivation}</p>}
          {c.recruitment_location && <p className="kv blue"><span className="k">Found at</span><span className="v">{c.recruitment_location}</span></p>}
          {(c.connection_to_main_quest || c.personal_quest_hook) && (
            <InlineSpoiler label="their thread">
              {c.connection_to_main_quest && <p className="kv"><span className="k">Main quest</span>{c.connection_to_main_quest}</p>}
              {c.personal_quest_hook && <p className="kv"><span className="k">Personal quest</span>{c.personal_quest_hook}</p>}
            </InlineSpoiler>
          )}
        </div>
      ))}
    </div>
  );

  const renderLocations = () => (
    <div className="read-grid">
      {plan.locations?.map((loc, idx) => (
        <div className="read" key={loc.id || idx}>
          <div className="marker"><Ic n="pin" />{loc.type ? cap(loc.type) : 'Location'}</div>
          <h3>{loc.name}</h3>
          {loc.region && <p className="kv"><span className="k">Region</span>{loc.region}</p>}
          {loc.description && <p style={{ marginTop: 10 }}>{loc.description}</p>}
          {(loc.importance_to_plot || loc.dangers?.length > 0) && (
            <InlineSpoiler label="what waits here">
              {loc.importance_to_plot && <p className="kv"><span className="k">Plot importance</span>{loc.importance_to_plot}</p>}
              {loc.dangers?.length > 0 && <p className="kv"><span className="k">Dangers</span>{loc.dangers.join(', ')}</p>}
            </InlineSpoiler>
          )}
        </div>
      ))}
    </div>
  );

  const renderMerchants = () => (
    <div className="read-grid">
      {plan.merchants?.map((m, idx) => (
        <div className="read" key={m.id || idx}>
          <div className="marker"><Ic n="coins" />{m.type ? cap(m.type) : 'Merchant'}</div>
          <h3>{m.name}</h3>
          {m.location && <p className="kv blue"><span className="k">Location</span><span className="v">{m.location}</span></p>}
          {m.specialty && <p className="kv"><span className="k">Specialty</span>{m.specialty}</p>}
          {m.personality && <p className="italic" style={{ marginTop: 10 }}>&ldquo;{m.personality}&rdquo;</p>}
          <div className="tagline"><span className="chip">{m.prosperity_level || 'comfortable'}</span></div>
        </div>
      ))}
      {(!plan.merchants || plan.merchants.length === 0) && (
        <p className="empty-note">No merchants defined in the campaign plan. Regenerate the plan to add merchants.</p>
      )}
    </div>
  );

  const renderFactions = () => (
    <div className="read-grid">
      {plan.factions?.map((f, idx) => {
        const relClass = REL_CLASS[f.relationship_to_party] || 'warn';
        return (
          <div className="read" key={f.id || idx}>
            <div className="marker"><Ic n="shield" />{f.type ? cap(f.type) : 'Faction'}</div>
            <h3>{f.name}</h3>
            {f.description && <p>{f.description}</p>}
            <InlineSpoiler label="allegiance & goals">
              {f.relationship_to_party && (
                <p className="kv"><span className="k">Toward you</span><span className={`chip ${relClass}`}>{f.relationship_to_party}</span></p>
              )}
              {f.goals?.length > 0 && (
                <>
                  <p className="kv"><span className="k">Goals</span></p>
                  <ul className="note">{f.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </>
              )}
              {f.key_members?.length > 0 && <p className="kv"><span className="k">Key members</span>{f.key_members.join(', ')}</p>}
            </InlineSpoiler>
          </div>
        );
      })}
    </div>
  );

  const renderSideQuests = () => (
    <div className="read-grid">
      {plan.side_quests?.map((q, idx) => (
        <div className="read" key={q.id || idx}>
          <div className="marker"><Ic n="scroll" />{q.type ? cap(q.type) : 'Side quest'}</div>
          <h3>{q.title}</h3>
          {q.description && <p>{q.description}</p>}
          {q.quest_giver && <p className="kv"><span className="k">Quest giver</span>{q.quest_giver}</p>}
          {q.location && <p className="kv blue"><span className="k">Location</span><span className="v">{q.location}</span></p>}
          {q.rewards && <p className="kv gold"><span className="k">Rewards</span><span className="v">{q.rewards}</span></p>}
          {q.connection_to_main_quest && (
            <InlineSpoiler label="how it ties in">
              <p>{q.connection_to_main_quest}</p>
            </InlineSpoiler>
          )}
        </div>
      ))}
    </div>
  );

  const renderDMNotes = () => {
    const dm = plan.dm_notes || {};
    return (
      <div className="read-grid single">
        <div className="plan-sub" style={{ marginBottom: 4 }}>
          This is the DM's veil — everything here is spoilers. Reveal carefully.
        </div>

        {dm.tone_guidance && (
          <div className="read">
            <div className="marker"><Ic n="feather" />Tone</div>
            <h3>How it should feel</h3>
            <p>{dm.tone_guidance}</p>
          </div>
        )}

        {dm.session_zero_topics?.length > 0 && (
          <div className="read">
            <div className="marker blue"><Ic n="users" />Before you begin</div>
            <h3>Session-zero topics</h3>
            <ul className="note">{dm.session_zero_topics.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}

        {dm.potential_twists?.length > 0 && (
          <VeilCard revealLabel="Reveal — potential twists" accent>
            <div className="marker spoiler-m"><Ic n="eye-off" />The turns</div>
            <h3>Potential twists</h3>
            <ul className="note">{dm.potential_twists.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </VeilCard>
        )}

        {dm.backup_hooks?.length > 0 && (
          <VeilCard revealLabel="Reveal — backup hooks">
            <div className="marker"><Ic n="flag" />In reserve</div>
            <h3>Backup hooks</h3>
            <ul className="note">{dm.backup_hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </VeilCard>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'main_quest': return renderMainQuest();
      case 'world': return renderWorldState();
      case 'timeline': return renderTimeline();
      case 'npcs': return renderNPCs();
      case 'companions': return renderCompanions();
      case 'locations': return renderLocations();
      case 'merchants': return renderMerchants();
      case 'factions': return renderFactions();
      case 'side_quests': return renderSideQuests();
      case 'dm_notes': return renderDMNotes();
      default: return renderOverview();
    }
  };

  // ─── main view ──────────────────────────────────────────────────
  return (
    <div className="hearth campaign-plan app-bg">
      <HearthSprite />
      <Header />

      <main className="page">
        <div className="plan-head">
          <h1>{plan.main_quest?.title || 'Campaign Plan'}</h1>
          <span className="by"><span className="dot"></span>World bible · written by Opus</span>
          <div className="plan-actions">
            {!confirmRegen && !generating && (
              <button className="btn danger sm" onClick={() => setConfirmRegen(true)}>Regenerate plan</button>
            )}
            {confirmRegen && !generating && (
              <>
                <span className="plan-confirm">Replace the current plan?</span>
                <button className="btn danger sm" onClick={() => { setConfirmRegen(false); generatePlan(); }}>Yes, regenerate</button>
                <button className="btn ghost sm" onClick={() => setConfirmRegen(false)}>Cancel</button>
              </>
            )}
          </div>
        </div>
        <div className="plan-sub">
          Read-only. What you've seen in play is plain; what you haven't is kept behind a veil, so you never spoil your own story.
        </div>

        {generating && (
          <div className="gen-banner">
            <div className="gen-prog" style={{ maxWidth: 'none', margin: 0 }}>
              <div className="gprow">
                <span className="gpstep">{GENERATION_STEPS[genStep]?.label}</span>
                <span className="gppct">{genProgress}%</span>
              </div>
              <div className="gptrack"><div className="fill" style={{ width: `${genProgress}%` }} /></div>
              <p className="gpcap">Claude Opus is crafting your living world…</p>
            </div>
          </div>
        )}

        {error && <p className="err-line">{error}</p>}

        <nav className="tabs">
          {TABS.map(tab => {
            const ct = tab.count ? tab.count(plan) : null;
            return (
              <button
                key={tab.key}
                className={`tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Ic n={tab.icon} />{tab.label}
                {ct ? <span className="ct">{ct}</span> : null}
              </button>
            );
          })}
        </nav>

        {renderTabContent()}
      </main>
    </div>
  );
}
