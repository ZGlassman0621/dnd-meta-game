import { useState, useEffect } from 'react';

function Spoiler({ label, children }) {
  const [revealed, setRevealed] = useState(false);

  if (!children) return null;

  return revealed ? (
    <div style={{
      position: 'relative',
      borderLeft: '2px solid rgba(231, 76, 60, 0.4)',
      paddingLeft: '0.75rem',
      marginTop: '0.5rem'
    }}>
      <button
        onClick={() => setRevealed(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#e74c3c',
          fontSize: '0.75rem',
          cursor: 'pointer',
          padding: 0,
          marginBottom: '0.25rem',
          opacity: 0.7
        }}
      >
        Hide {label}
      </button>
      {children}
    </div>
  ) : (
    <button
      onClick={() => setRevealed(true)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        background: 'rgba(231, 76, 60, 0.15)',
        border: '1px solid rgba(231, 76, 60, 0.3)',
        borderRadius: '4px',
        color: '#e74c3c',
        fontSize: '0.8rem',
        cursor: 'pointer',
        padding: '0.3rem 0.6rem',
        marginTop: '0.5rem',
        transition: 'all 0.2s'
      }}
      onMouseEnter={e => {
        e.target.style.background = 'rgba(231, 76, 60, 0.25)';
      }}
      onMouseLeave={e => {
        e.target.style.background = 'rgba(231, 76, 60, 0.15)';
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>&#128065;</span> Reveal {label}
    </button>
  );
}

const styles = {
  container: {
    padding: '1rem',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '1.5rem'
  },
  title: {
    fontSize: '1.8rem',
    marginBottom: '0.5rem',
    color: '#f5f5f5'
  },
  subtitle: {
    color: '#888',
    fontSize: '0.95rem'
  },
  generateSection: {
    background: 'rgba(155, 89, 182, 0.1)',
    border: '1px solid rgba(155, 89, 182, 0.3)',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    textAlign: 'center'
  },
  generateButton: {
    background: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
    color: '#fff',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '0.5rem'
  },
  tab: {
    padding: '0.5rem 1rem',
    borderRadius: '4px 4px 0 0',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s',
    background: 'transparent',
    color: '#888'
  },
  tabActive: {
    background: 'rgba(155, 89, 182, 0.2)',
    color: '#9b59b6',
    borderBottom: '2px solid #9b59b6'
  },
  panel: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    padding: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  sectionTitle: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
    color: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  questArc: {
    marginBottom: '1.5rem'
  },
  actCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.75rem',
    borderLeft: '3px solid #9b59b6'
  },
  actTitle: {
    fontSize: '1rem',
    color: '#f5f5f5',
    marginBottom: '0.5rem',
    fontWeight: '500'
  },
  npcGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem'
  },
  npcCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '1rem',
    border: '1px solid transparent'
  },
  npcBackstory: {
    borderColor: 'rgba(46, 204, 113, 0.5)',
    background: 'rgba(46, 204, 113, 0.05)'
  },
  npcName: {
    fontSize: '1rem',
    color: '#f5f5f5',
    marginBottom: '0.25rem',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  badge: {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '500',
    textTransform: 'uppercase'
  },
  roleBadge: {
    ally: { background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' },
    enemy: { background: 'rgba(231, 76, 60, 0.3)', color: '#e74c3c' },
    neutral: { background: 'rgba(149, 165, 166, 0.3)', color: '#95a5a6' },
    patron: { background: 'rgba(241, 196, 15, 0.3)', color: '#f1c40f' },
    rival: { background: 'rgba(230, 126, 34, 0.3)', color: '#e67e22' },
    mentor: { background: 'rgba(52, 152, 219, 0.3)', color: '#3498db' }
  },
  eventTimeline: {
    position: 'relative',
    paddingLeft: '1.5rem',
    borderLeft: '2px solid rgba(155, 89, 182, 0.3)'
  },
  eventCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '1rem',
    position: 'relative'
  },
  eventDot: {
    position: 'absolute',
    left: '-1.75rem',
    top: '1rem',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#9b59b6'
  },
  locationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem'
  },
  locationCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '1rem'
  },
  factionCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.75rem'
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#888'
  },
  textMuted: {
    color: '#888',
    fontSize: '0.9rem'
  },
  textSmall: {
    color: '#666',
    fontSize: '0.85rem'
  },
  list: {
    margin: '0.5rem 0',
    paddingLeft: '1.25rem'
  },
  worldStateGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem'
  },
  infoBox: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
    padding: '1rem'
  }
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'main_quest', label: 'Main Quest' },
  { key: 'world', label: 'World State' },
  { key: 'timeline', label: 'World Timeline' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'companions', label: 'Companions' },
  { key: 'locations', label: 'Locations' },
  { key: 'merchants', label: 'Merchants' },
  { key: 'factions', label: 'Factions' },
  { key: 'side_quests', label: 'Side Quests' },
  { key: 'dm_notes', label: 'DM Notes' }
];

const GENERATION_STEPS = [
  { label: 'Connecting to Opus 4.5...', duration: 3000 },
  { label: 'Analyzing character backstory...', duration: 5000 },
  { label: 'Building world state & politics...', duration: 8000 },
  { label: 'Creating main quest arc...', duration: 10000 },
  { label: 'Generating NPCs & factions...', duration: 8000 },
  { label: 'Designing locations & side quests...', duration: 8000 },
  { label: 'Building world timeline...', duration: 6000 },
  { label: 'Finalizing campaign plan...', duration: 12000 }
];

export default function CampaignPlanPage({ character }) {
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

  if (!character?.campaign_id) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Campaign Plan</h1>
          <p style={styles.subtitle}>View and manage your campaign's master plan</p>
        </div>
        <div style={styles.panel}>
          <p style={styles.textMuted}>
            No campaign assigned. Please assign this character to a campaign first.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading campaign plan...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Campaign Plan</h1>
          <p style={styles.subtitle}>Generate a comprehensive campaign plan using Claude Opus 4.5</p>
        </div>

        <div style={styles.generateSection}>
          <h3 style={{ marginBottom: '0.5rem', color: '#f5f5f5' }}>No Campaign Plan Yet</h3>
          <p style={{ ...styles.textMuted, marginBottom: '1rem' }}>
            Generate a living world campaign with your character's backstory woven into the narrative.
            This uses Claude Opus 4.5 for high-quality world building.
          </p>

          {error && (
            <p style={{ color: '#e74c3c', marginBottom: '1rem' }}>{error}</p>
          )}

          {!generating && (
            <button
              style={styles.generateButton}
              onClick={generatePlan}
            >
              Generate Campaign Plan
            </button>
          )}

          {generating && (
            <div style={{ marginTop: '1rem', maxWidth: '500px', margin: '1rem auto 0' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                alignItems: 'center'
              }}>
                <span style={{ color: '#f5f5f5', fontSize: '0.9rem' }}>
                  {GENERATION_STEPS[genStep]?.label}
                </span>
                <span style={{ color: '#9b59b6', fontSize: '0.85rem', fontWeight: '500' }}>
                  {genProgress}%
                </span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                height: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #9b59b6, #8e44ad)',
                  height: '100%',
                  borderRadius: '4px',
                  width: `${genProgress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ ...styles.textSmall, marginTop: '0.75rem' }}>
                Opus 4.5 is crafting your living world...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={styles.sectionTitle}>{plan.main_quest?.title || 'Campaign'}</h2>
        <Spoiler label="Plot Summary">
          <p style={styles.textMuted}>{plan.main_quest?.summary}</p>
        </Spoiler>
      </div>

      {plan.themes?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ ...styles.sectionTitle, fontSize: '1rem' }}>Themes</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {plan.themes.map((theme, idx) => (
              <span key={idx} style={{
                ...styles.badge,
                background: 'rgba(155, 89, 182, 0.2)',
                color: '#9b59b6'
              }}>
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      <Spoiler label="World Overview">
        <div style={styles.worldStateGrid}>
          <div style={styles.infoBox}>
            <h4 style={{ color: '#f5f5f5', marginBottom: '0.5rem' }}>World State</h4>
            <p style={styles.textSmall}>{plan.world_state?.political_situation}</p>
          </div>
          <div style={styles.infoBox}>
            <h4 style={{ color: '#f5f5f5', marginBottom: '0.5rem' }}>Major Threats</h4>
            <ul style={{ ...styles.list, ...styles.textSmall }}>
              {plan.world_state?.major_threats?.map((threat, idx) => (
                <li key={idx}>{threat}</li>
              ))}
            </ul>
          </div>
        </div>
      </Spoiler>

      <div style={{ marginTop: '1rem', ...styles.textSmall }}>
        <p>Generated: {new Date(plan.generated_at).toLocaleString()}</p>
        {plan.last_modified !== plan.generated_at && (
          <p>Last modified: {new Date(plan.last_modified).toLocaleString()}</p>
        )}
      </div>
    </div>
  );

  const renderMainQuest = () => (
    <div>
      <h2 style={styles.sectionTitle}>{plan.main_quest?.title}</h2>

      <Spoiler label="Summary">
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={styles.textMuted}>{plan.main_quest?.summary}</p>
        </div>
      </Spoiler>

      <Spoiler label="How It Begins">
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={styles.textMuted}>{plan.main_quest?.hook}</p>
        </div>
      </Spoiler>

      <Spoiler label="Stakes">
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#e74c3c', marginBottom: '0.5rem' }}>Stakes</h4>
          <p style={styles.textMuted}>{plan.main_quest?.stakes}</p>
        </div>
      </Spoiler>

      <h3 style={{ ...styles.sectionTitle, fontSize: '1.1rem', marginTop: '1.5rem' }}>Story Acts</h3>
      {plan.main_quest?.acts?.map((act, idx) => (
        <div key={idx} style={styles.actCard}>
          <div style={styles.actTitle}>Act {act.act_number}: {act.title}</div>
          <Spoiler label={`Act ${act.act_number} Details`}>
            <p style={styles.textMuted}>{act.summary}</p>

            {act.key_locations?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={styles.textSmall}>Locations: </span>
                {act.key_locations.map((loc, i) => (
                  <span key={i} style={{ ...styles.badge, background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', marginRight: '0.25rem' }}>
                    {loc}
                  </span>
                ))}
              </div>
            )}

            {act.key_npcs?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={styles.textSmall}>NPCs: </span>
                {act.key_npcs.map((npc, i) => (
                  <span key={i} style={{ ...styles.badge, background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', marginRight: '0.25rem' }}>
                    {npc}
                  </span>
                ))}
              </div>
            )}

            {act.potential_outcomes?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={styles.textSmall}>Potential Outcomes: </span>
                <ul style={{ ...styles.list, ...styles.textSmall }}>
                  {act.potential_outcomes.map((outcome, i) => (
                    <li key={i}>{outcome}</li>
                  ))}
                </ul>
              </div>
            )}
          </Spoiler>
        </div>
      ))}
    </div>
  );

  const renderWorldState = () => (
    <div>
      <h2 style={styles.sectionTitle}>World State - Faerun, 1350 DR</h2>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#f5f5f5', marginBottom: '0.5rem' }}>Political Situation</h4>
        <p style={styles.textMuted}>{plan.world_state?.political_situation}</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#e74c3c', marginBottom: '0.5rem' }}>Major Threats</h4>
        <ul style={{ ...styles.list, ...styles.textMuted }}>
          {plan.world_state?.major_threats?.map((threat, idx) => (
            <li key={idx}>{threat}</li>
          ))}
        </ul>
      </div>

      {plan.world_state?.faction_tensions?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>Faction Tensions</h4>
          {plan.world_state.faction_tensions.map((tension, idx) => (
            <div key={idx} style={styles.factionCard}>
              <div style={{ color: '#f5f5f5', marginBottom: '0.25rem' }}>
                {tension.factions?.join(' vs ')}
              </div>
              <p style={styles.textSmall}>{tension.nature}</p>
              <p style={{ ...styles.textSmall, fontStyle: 'italic' }}>{tension.current_state}</p>
            </div>
          ))}
        </div>
      )}

      {plan.world_state?.regional_news?.length > 0 && (
        <div>
          <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>Regional News</h4>
          <ul style={{ ...styles.list, ...styles.textMuted }}>
            {plan.world_state.regional_news.map((news, idx) => (
              <li key={idx}>{news}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderTimeline = () => (
    <div>
      <h2 style={styles.sectionTitle}>World Timeline</h2>
      <p style={{ ...styles.textMuted, marginBottom: '1.5rem' }}>
        {plan.world_timeline?.description}
      </p>
      <p style={{ ...styles.textSmall, marginBottom: '1rem', fontStyle: 'italic' }}>
        These events will occur regardless of player intervention, creating a living world.
      </p>

      <div style={styles.eventTimeline}>
        {plan.world_timeline?.events?.map((event, idx) => (
          <div key={event.id || idx} style={styles.eventCard}>
            <div style={styles.eventDot} />
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              World Event {idx + 1}
            </div>
            <Spoiler label={`Event ${idx + 1}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ color: '#f5f5f5', fontWeight: '500' }}>{event.title}</span>
                <span style={{
                  ...styles.badge,
                  background: event.visibility === 'secret' ? 'rgba(231, 76, 60, 0.2)' :
                             event.visibility === 'rumored' ? 'rgba(241, 196, 15, 0.2)' :
                             'rgba(46, 204, 113, 0.2)',
                  color: event.visibility === 'secret' ? '#e74c3c' :
                         event.visibility === 'rumored' ? '#f1c40f' :
                         '#2ecc71'
                }}>
                  {event.visibility}
                </span>
              </div>
              <div style={{ ...styles.textSmall, marginBottom: '0.5rem' }}>
                Timing: {event.timing}
              </div>
              <p style={styles.textMuted}>{event.description}</p>
              {event.consequences_if_ignored && (
                <p style={{ ...styles.textSmall, color: '#e74c3c', marginTop: '0.5rem' }}>
                  If ignored: {event.consequences_if_ignored}
                </p>
              )}
            </Spoiler>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNPCs = () => (
    <div>
      <h2 style={styles.sectionTitle}>Key NPCs</h2>
      <p style={{ ...styles.textMuted, marginBottom: '1rem' }}>
        Characters with green borders are from your backstory.
      </p>

      <div style={styles.npcGrid}>
        {plan.npcs?.map((npc, idx) => (
          <div
            key={npc.id || idx}
            style={{
              ...styles.npcCard,
              ...(npc.from_backstory ? styles.npcBackstory : {})
            }}
          >
            <div style={styles.npcName}>
              {npc.name}
              {npc.from_backstory && (
                <span style={{ ...styles.badge, background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' }}>
                  Backstory
                </span>
              )}
            </div>
            <p style={styles.textMuted}>{npc.description}</p>
            {npc.location && (
              <div style={{ marginTop: '0.25rem' }}>
                <span style={styles.textSmall}>Location: </span>
                <span style={{ ...styles.textSmall, color: '#3498db' }}>{npc.location}</span>
              </div>
            )}
            <Spoiler label="Role & Secrets">
              <div style={{ marginTop: '0.25rem' }}>
                <span style={styles.textSmall}>Role: </span>
                <span style={{
                  ...styles.badge,
                  ...(styles.roleBadge[npc.role] || styles.roleBadge.neutral)
                }}>
                  {npc.role}
                </span>
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <span style={styles.textSmall}>Motivation: </span>
                <span style={{ ...styles.textSmall, color: '#bbb' }}>{npc.motivation}</span>
              </div>
              {npc.secrets?.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ ...styles.textSmall, color: '#e74c3c' }}>Secrets: </span>
                  <ul style={{ ...styles.list, ...styles.textSmall, color: '#e74c3c' }}>
                    {npc.secrets.map((secret, i) => (
                      <li key={i}>{secret}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Spoiler>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompanions = () => (
    <div>
      <h2 style={styles.sectionTitle}>Potential Companions</h2>
      <p style={{ ...styles.textMuted, marginBottom: '1rem' }}>
        Characters who could join your party during the adventure.
      </p>

      <div style={styles.npcGrid}>
        {plan.potential_companions?.map((companion, idx) => (
          <div key={companion.id || idx} style={styles.npcCard}>
            <div style={styles.npcName}>
              {companion.name}
              <span style={{ ...styles.badge, background: 'rgba(52, 152, 219, 0.2)', color: '#3498db' }}>
                {companion.race} {companion.class}
              </span>
            </div>
            <p style={styles.textMuted}>{companion.personality}</p>
            <div style={{ marginTop: '0.5rem' }}>
              <span style={styles.textSmall}>Motivation: </span>
              <span style={{ ...styles.textSmall, color: '#bbb' }}>{companion.motivation}</span>
            </div>
            <div style={{ marginTop: '0.25rem' }}>
              <span style={styles.textSmall}>Found at: </span>
              <span style={{ ...styles.textSmall, color: '#3498db' }}>{companion.recruitment_location}</span>
            </div>
            <Spoiler label="Personal Quest">
              {companion.connection_to_main_quest && (
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={styles.textSmall}>Main Quest Connection: </span>
                  <span style={{ ...styles.textSmall, color: '#9b59b6' }}>{companion.connection_to_main_quest}</span>
                </div>
              )}
              {companion.personal_quest_hook && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(155, 89, 182, 0.1)', borderRadius: '4px' }}>
                  <span style={{ ...styles.textSmall, color: '#9b59b6' }}>Personal Quest: </span>
                  <span style={styles.textSmall}>{companion.personal_quest_hook}</span>
                </div>
              )}
            </Spoiler>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLocations = () => (
    <div>
      <h2 style={styles.sectionTitle}>Key Locations</h2>

      <div style={styles.locationGrid}>
        {plan.locations?.map((location, idx) => (
          <div key={location.id || idx} style={styles.locationCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ color: '#f5f5f5', fontWeight: '500' }}>{location.name}</span>
              <span style={{ ...styles.badge, background: 'rgba(52, 152, 219, 0.2)', color: '#3498db' }}>
                {location.type}
              </span>
            </div>
            <div style={{ ...styles.textSmall, marginBottom: '0.5rem' }}>{location.region}</div>
            <p style={styles.textMuted}>{location.description}</p>

            <Spoiler label="Plot Details">
              {location.importance_to_plot && (
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{ ...styles.textSmall, color: '#9b59b6' }}>Plot importance: </span>
                  <span style={styles.textSmall}>{location.importance_to_plot}</span>
                </div>
              )}
              {location.dangers?.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <span style={{ ...styles.textSmall, color: '#e74c3c' }}>Dangers: </span>
                  <span style={styles.textSmall}>{location.dangers.join(', ')}</span>
                </div>
              )}
            </Spoiler>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMerchants = () => (
    <div>
      <h2 style={styles.sectionTitle}>Merchants</h2>
      <p style={{ ...styles.textMuted, marginBottom: '1rem' }}>
        Shopkeepers and traders in your campaign world. Their inventories are generated from loot tables based on type and prosperity.
      </p>

      <div style={styles.locationGrid}>
        {plan.merchants?.map((merchant, idx) => (
          <div key={merchant.id || idx} style={styles.locationCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ color: '#f5f5f5', fontWeight: '500' }}>{merchant.name}</span>
              <span style={{ ...styles.badge, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                {merchant.type}
              </span>
            </div>
            <div style={{ ...styles.textSmall, marginBottom: '0.25rem' }}>
              <span style={{ color: '#3498db' }}>{merchant.location}</span>
            </div>
            {merchant.specialty && (
              <div style={{ ...styles.textSmall, marginBottom: '0.25rem' }}>
                <span style={{ color: '#888' }}>Specialty: </span>
                <span style={{ color: '#bbb' }}>{merchant.specialty}</span>
              </div>
            )}
            {merchant.personality && (
              <div style={{ ...styles.textSmall, fontStyle: 'italic', color: '#a78bfa', marginBottom: '0.5rem' }}>
                "{merchant.personality}"
              </div>
            )}
            <span style={{
              ...styles.badge,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              fontSize: '0.7rem'
            }}>
              {merchant.prosperity_level || 'comfortable'}
            </span>
          </div>
        ))}
        {(!plan.merchants || plan.merchants.length === 0) && (
          <p style={styles.textMuted}>No merchants defined in the campaign plan. Regenerate the plan to add merchants.</p>
        )}
      </div>
    </div>
  );

  const renderFactions = () => (
    <div>
      <h2 style={styles.sectionTitle}>Factions</h2>

      {plan.factions?.map((faction, idx) => (
        <div key={faction.id || idx} style={styles.factionCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ color: '#f5f5f5', fontWeight: '500', fontSize: '1.05rem' }}>{faction.name}</span>
            <span style={{ ...styles.badge, background: 'rgba(149, 165, 166, 0.2)', color: '#95a5a6' }}>
              {faction.type}
            </span>
          </div>
          <p style={styles.textMuted}>{faction.description}</p>

          <Spoiler label="Allegiance & Goals">
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={styles.textSmall}>Relationship: </span>
              <span style={{
                ...styles.badge,
                background: faction.relationship_to_party === 'ally' ? 'rgba(46, 204, 113, 0.2)' :
                           faction.relationship_to_party === 'enemy' ? 'rgba(231, 76, 60, 0.2)' :
                           'rgba(241, 196, 15, 0.2)',
                color: faction.relationship_to_party === 'ally' ? '#2ecc71' :
                       faction.relationship_to_party === 'enemy' ? '#e74c3c' :
                       '#f1c40f'
              }}>
                {faction.relationship_to_party}
              </span>
            </div>
            {faction.goals?.length > 0 && (
              <div style={{ marginTop: '0.25rem' }}>
                <span style={styles.textSmall}>Goals: </span>
                <ul style={{ ...styles.list, ...styles.textSmall }}>
                  {faction.goals.map((goal, i) => (
                    <li key={i}>{goal}</li>
                  ))}
                </ul>
              </div>
            )}

            {faction.key_members?.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={styles.textSmall}>Key Members: </span>
                <span style={styles.textSmall}>{faction.key_members.join(', ')}</span>
              </div>
            )}
          </Spoiler>
        </div>
      ))}
    </div>
  );

  const renderSideQuests = () => (
    <div>
      <h2 style={styles.sectionTitle}>Side Quests</h2>

      {plan.side_quests?.map((quest, idx) => (
        <div key={quest.id || idx} style={styles.actCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span style={{ color: '#f5f5f5', fontWeight: '500' }}>{quest.title}</span>
            <span style={{ ...styles.badge, background: 'rgba(52, 152, 219, 0.2)', color: '#3498db' }}>
              {quest.type}
            </span>
          </div>
          <p style={styles.textMuted}>{quest.description}</p>

          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {quest.quest_giver && (
              <span style={styles.textSmall}>Quest Giver: <span style={{ color: '#2ecc71' }}>{quest.quest_giver}</span></span>
            )}
            {quest.location && (
              <span style={styles.textSmall}>Location: <span style={{ color: '#3498db' }}>{quest.location}</span></span>
            )}
            {quest.rewards && (
              <span style={styles.textSmall}>Rewards: <span style={{ color: '#f1c40f' }}>{quest.rewards}</span></span>
            )}
          </div>

          {quest.connection_to_main_quest && (
            <Spoiler label="Quest Connection">
              <div style={{ padding: '0.5rem', background: 'rgba(155, 89, 182, 0.1)', borderRadius: '4px' }}>
                <span style={{ ...styles.textSmall, color: '#9b59b6' }}>Main Quest Connection: </span>
                <span style={styles.textSmall}>{quest.connection_to_main_quest}</span>
              </div>
            </Spoiler>
          )}
        </div>
      ))}
    </div>
  );

  const renderDMNotes = () => (
    <div>
      <h2 style={styles.sectionTitle}>DM Notes</h2>
      <p style={{ ...styles.textSmall, marginBottom: '1rem', fontStyle: 'italic', color: '#e74c3c' }}>
        This entire section contains spoilers. Reveal carefully.
      </p>

      {plan.dm_notes?.tone_guidance && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#f5f5f5', marginBottom: '0.5rem' }}>Tone Guidance</h4>
          <p style={styles.textMuted}>{plan.dm_notes.tone_guidance}</p>
        </div>
      )}

      {plan.dm_notes?.session_zero_topics?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>Session Zero Topics</h4>
          <ul style={{ ...styles.list, ...styles.textMuted }}>
            {plan.dm_notes.session_zero_topics.map((topic, idx) => (
              <li key={idx}>{topic}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.dm_notes?.potential_twists?.length > 0 && (
        <Spoiler label="Potential Twists">
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#e74c3c', marginBottom: '0.5rem' }}>Potential Twists</h4>
            <ul style={{ ...styles.list, ...styles.textMuted }}>
              {plan.dm_notes.potential_twists.map((twist, idx) => (
                <li key={idx}>{twist}</li>
              ))}
            </ul>
          </div>
        </Spoiler>
      )}

      {plan.dm_notes?.backup_hooks?.length > 0 && (
        <Spoiler label="Backup Hooks">
          <div>
            <h4 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>Backup Hooks</h4>
            <ul style={{ ...styles.list, ...styles.textMuted }}>
              {plan.dm_notes.backup_hooks.map((hook, idx) => (
                <li key={idx}>{hook}</li>
              ))}
            </ul>
          </div>
        </Spoiler>
      )}
    </div>
  );

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

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={styles.title}>Campaign Plan</h1>
          <p style={styles.subtitle}>
            {plan.main_quest?.title || 'Your adventure awaits'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {!confirmRegen && !generating && (
            <button
              onClick={() => setConfirmRegen(true)}
              style={{
                background: 'rgba(231, 76, 60, 0.15)',
                border: '1px solid rgba(231, 76, 60, 0.3)',
                borderRadius: '6px',
                color: '#e74c3c',
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Regenerate Plan
            </button>
          )}
          {confirmRegen && !generating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Replace current plan?</span>
              <button
                onClick={() => { setConfirmRegen(false); generatePlan(); }}
                style={{
                  background: '#e74c3c',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Yes, Regenerate
              </button>
              <button
                onClick={() => setConfirmRegen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: '#888',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {generating && (
        <div style={{
          background: 'rgba(155, 89, 182, 0.1)',
          border: '1px solid rgba(155, 89, 182, 0.3)',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: '#f5f5f5', fontSize: '0.9rem' }}>
              {GENERATION_STEPS[genStep]?.label}
            </span>
            <span style={{ color: '#9b59b6', fontSize: '0.85rem', fontWeight: '500' }}>
              {genProgress}%
            </span>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(90deg, #9b59b6, #8e44ad)',
              height: '100%',
              borderRadius: '4px',
              width: `${genProgress}%`,
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p style={{ ...styles.textSmall, marginTop: '0.5rem' }}>
            Opus 4.5 is crafting your living world...
          </p>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          color: '#e74c3c',
          fontSize: '0.9rem'
        }}>
          {error}
        </div>
      )}

      <div style={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {})
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.panel}>
        {renderTabContent()}
      </div>
    </div>
  );
}
