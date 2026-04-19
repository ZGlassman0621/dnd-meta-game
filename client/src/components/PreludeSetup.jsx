import { useState } from 'react';

const ACCENT = '#c084fc'; // Purple — origin story feel

const TIME_SPANS = [
  { id: 'childhood_to_young_adult', label: 'Childhood to Young Adult', description: 'Follow them from early memories through their formative years' },
  { id: 'last_few_years', label: 'The Last Few Years', description: 'Focus on the recent events that shaped who they are now' },
  { id: 'single_pivotal_event', label: 'A Single Pivotal Event', description: 'One defining moment that changed everything' },
  { id: 'coming_of_age', label: 'Coming of Age', description: 'The transition from youth to the cusp of adventure' }
];

const THEME_OPTIONS = [
  { id: 'loss', label: 'Loss' },
  { id: 'duty', label: 'Duty' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'rebellion', label: 'Rebellion' },
  { id: 'survival', label: 'Survival' },
  { id: 'mentorship', label: 'Mentorship' },
  { id: 'betrayal', label: 'Betrayal' },
  { id: 'ambition', label: 'Ambition' },
  { id: 'love', label: 'Love' },
  { id: 'faith', label: 'Faith' },
  { id: 'isolation', label: 'Isolation' },
  { id: 'redemption', label: 'Redemption' }
];

const TONE_OPTIONS = [
  { id: 'heroic', label: 'Heroic' },
  { id: 'gritty', label: 'Gritty' },
  { id: 'dark', label: 'Dark' },
  { id: 'lighthearted', label: 'Lighthearted' },
  { id: 'mysterious', label: 'Mysterious' },
  { id: 'bittersweet', label: 'Bittersweet' },
  { id: 'epic', label: 'Epic' },
  { id: 'intimate', label: 'Intimate' }
];

const sectionStyle = {
  marginBottom: '1.5rem'
};

const labelStyle = {
  display: 'block',
  color: '#ccc',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  marginBottom: '0.5rem'
};

const sublabelStyle = {
  display: 'block',
  color: '#888',
  fontSize: '0.78rem',
  fontWeight: 'normal',
  marginTop: '0.15rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${ACCENT}33`,
  borderRadius: '6px',
  color: '#ddd',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box'
};

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: '1.5'
};

export default function PreludeSetup({ character, onStartPrelude, onBack, isLoading, error }) {
  const [preludeLocation, setPreludeLocation] = useState('');
  const [endingLocation, setEndingLocation] = useState('');
  const [timeSpan, setTimeSpan] = useState('childhood_to_young_adult');
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [tones, setTones] = useState(['heroic']);
  const toggleTone = (id) => {
    setTones(prev => {
      if (prev.includes(id)) {
        // Don't let the user deselect the last tone — one is required
        return prev.length > 1 ? prev.filter(t => t !== id) : prev;
      }
      return [...prev, id];
    });
  };
  const [storyBeats, setStoryBeats] = useState('');

  const toggleTheme = (id) => {
    setSelectedThemes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    onStartPrelude({
      preludeLocation: preludeLocation.trim() || null,
      endingLocation: endingLocation.trim() || null,
      timeSpan,
      themes: selectedThemes,
      // Backend schema expects a single `tone` string. Join multi-tone picks
      // with " + " (e.g. "hopeful + gritty") — the prelude prompt treats the
      // string as a descriptor, so the blended form reads naturally.
      tone: tones.join(' + '),
      tones, // also include the array for any callers that want the raw list
      storyBeats: storyBeats.trim() || null
    });
  };

  // Pull useful info from character for display hints
  const charBackground = character.background;
  const charBackstory = character.backstory;
  const hasBackstory = charBackstory && charBackstory.trim().length > 20;

  // Presentation helpers
  const titleCase = (s) => (s || '')
    .toString()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const raceLabel = [character.subrace, character.race]
    .filter(Boolean)
    .map(titleCase)
    .join(' ');
  const classLabel = titleCase(character.class);
  const backgroundLabel = titleCase(charBackground);

  // Gendered pronouns for the intro blurb. Falls back to they/them for
  // non-binary, other, or unset gender.
  const gender = (character.gender || '').toLowerCase();
  const pronouns = gender === 'male' || gender === 'm'
    ? { subject: 'he', object: 'him', possessive: 'his' }
    : gender === 'female' || gender === 'f'
    ? { subject: 'she', object: 'her', possessive: 'her' }
    : { subject: 'they', object: 'them', possessive: 'their' };

  return (
    <div className="dm-session-container">
      <div className="dm-session-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2 style={{ color: ACCENT }}>Character Prelude</h2>
      </div>

      <div className="dm-setup">
        {/* Character Preview */}
        <div style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          borderRadius: '8px',
          background: `rgba(192, 132, 252, 0.08)`,
          border: `1px solid ${ACCENT}33`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: ACCENT }}>{character.nickname || character.name}</h3>
              <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                Level {character.level} {raceLabel} {classLabel}
                {backgroundLabel && <span style={{ color: '#aaa' }}> — {backgroundLabel}</span>}
              </p>
            </div>
          </div>
          {hasBackstory && (
            <p style={{
              margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#aaa',
              fontStyle: 'italic', lineHeight: '1.5',
              maxHeight: '4.5rem', overflow: 'hidden'
            }}>
              "{charBackstory.substring(0, 200)}{charBackstory.length > 200 ? '...' : ''}"
            </p>
          )}
          {!hasBackstory && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#777' }}>
              No backstory written — the prelude will build one through play.
            </p>
          )}
        </div>

        {/* Intro blurb */}
        <div style={{
          padding: '1rem 1.25rem', marginBottom: '1.5rem',
          borderRadius: '8px', background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)', lineHeight: '1.6',
          fontSize: '0.88rem', color: '#bbb'
        }}>
          A prelude session tells the story of <strong style={{ color: '#ddd' }}>{character.nickname || character.name}</strong> before
          {' '}{pronouns.subject} became an adventurer. You'll play through formative moments, make lasting decisions,
          meet people who shaped {pronouns.object}, and arrive at the threshold of adventure with a character
          you truly know.
        </div>

        {/* Setup Form */}
        <div style={{ padding: '0 0.25rem' }}>
          {/* Prelude Location */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Where did they grow up?
              <span style={sublabelStyle}>The setting for their early life — a village, a city district, a monastery, the wilds</span>
            </label>
            <input
              type="text"
              value={preludeLocation}
              onChange={e => setPreludeLocation(e.target.value)}
              placeholder="A fishing village on the Sword Coast, the slums of Waterdeep, a secluded forest grove..."
              style={inputStyle}
            />
          </div>

          {/* Ending Location */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Where do we find them at the start of their adventure?
              <span style={sublabelStyle}>Where the prelude ends and the real campaign begins</span>
            </label>
            <input
              type="text"
              value={endingLocation}
              onChange={e => setEndingLocation(e.target.value)}
              placeholder="Arriving at Neverwinter, on the road heading south, at a crossroads tavern..."
              style={inputStyle}
            />
          </div>

          {/* Time Span */}
          <div style={sectionStyle}>
            <label style={labelStyle}>How much time passes?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {TIME_SPANS.map(ts => (
                <button
                  key={ts.id}
                  onClick={() => setTimeSpan(ts.id)}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: '6px',
                    border: timeSpan === ts.id ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)',
                    background: timeSpan === ts.id ? `${ACCENT}18` : 'rgba(255,255,255,0.03)',
                    color: timeSpan === ts.id ? ACCENT : '#bbb',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    fontWeight: timeSpan === ts.id ? 'bold' : 'normal'
                  }}
                >
                  {ts.label}
                  <br />
                  <small style={{ color: '#888', fontSize: '0.72rem', fontWeight: 'normal' }}>{ts.description}</small>
                </button>
              ))}
            </div>
          </div>

          {/* Themes */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Themes to explore
              <span style={sublabelStyle}>Select any that resonate — these guide the story's emotional core</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {THEME_OPTIONS.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTheme(t.id)}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '16px',
                    border: selectedThemes.includes(t.id) ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)',
                    background: selectedThemes.includes(t.id) ? `${ACCENT}22` : 'transparent',
                    color: selectedThemes.includes(t.id) ? ACCENT : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: selectedThemes.includes(t.id) ? 'bold' : 'normal'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Tone
              <span style={sublabelStyle}>Pick one or more — tones blend rather than compete</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {TONE_OPTIONS.map(t => {
                const isSelected = tones.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTone(t.id)}
                    style={{
                      padding: '0.35rem 0.7rem',
                      borderRadius: '16px',
                      border: isSelected ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)',
                      background: isSelected ? `${ACCENT}22` : 'transparent',
                      color: isSelected ? ACCENT : '#aaa',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 'bold' : 'normal'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Story Beats */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              Specific story beats (optional)
              <span style={sublabelStyle}>Moments you want the prelude to include — earning a family weapon, witnessing an event, meeting someone important</span>
            </label>
            <textarea
              value={storyBeats}
              onChange={e => setStoryBeats(e.target.value)}
              placeholder="I want them to earn their father's sword in a trial of some kind... They should witness something that sets them on their path... Their mentor should be a retired adventurer who sees potential in them..."
              rows={4}
              style={textareaStyle}
            />
          </div>

          {/* Error display */}
          {error && (
            <div style={{
              padding: '0.75rem 1rem', marginBottom: '1rem',
              borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5',
              fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '8px',
              border: 'none',
              background: isLoading ? '#555' : `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
              color: '#fff',
              fontSize: '1.05rem',
              fontWeight: 'bold',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              marginTop: '0.5rem'
            }}
          >
            {isLoading ? 'Preparing Prelude...' : `Begin ${character.nickname || character.name}'s Origin Story`}
          </button>
        </div>
      </div>
    </div>
  );
}
