import { useState, useEffect } from 'react';
import '../styles/hearth.css';
import '../styles/hearth-backstory.css';

/* ───────────────────────── Hearth · Backstory ─────────────────────────
   Faithful build of Hearth/Backstory.html: a dark-editorial two-column
   reading of the character's origin — the manuscript on the left, the parsed
   People / Places / Hooks (plus the app's Factions & Events) on the right.
   Pure render+style swap over the original parser: all state, fetching, and
   handlers below are harvested unchanged from the prior component.

   Data honesty notes:
   - The parser does not record character offsets into the raw backstory, so
     the mockup's hover-linked inline highlight marks cannot be wired to real
     spans. The manuscript renders as plain prose (no fabricated marks).
   - "click to edit" on the manuscript is not a feature here (editing happens
     in the Character Sheet), so that hint copy is omitted.
   ──────────────────────────────────────────────────────────────────────── */

/* local icon sprite (paths copied from Backstory.html defs + a few extras) */
const HearthSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
    <symbol id="i-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
    <symbol id="i-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z" /></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></symbol>
  </defs></svg>
);
const Ic = ({ n }) => <svg className="ic"><use href={`#i-${n}`} /></svg>;

export default function BackstoryParserPage({ character, onCharacterUpdated, onBack }) {
  const [parsedBackstory, setParsedBackstory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('characters');
  const [editingElement, setEditingElement] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addingElement, setAddingElement] = useState(null);
  const [addForm, setAddForm] = useState({});
  // which parsed item is being hovered, so item ↔ group highlight reads together
  const [hoverId, setHoverId] = useState(null);

  // group config: the app's five element types, themed to the design's pgroups.
  const groups = [
    { key: 'characters', cls: 'people',   title: 'People',   noun: 'a person',  empty: 'No people drawn from your story yet.' },
    { key: 'locations',  cls: 'places',   title: 'Places',   noun: 'a place',   empty: 'No places drawn from your story yet.' },
    { key: 'story_hooks',cls: 'hooks',    title: 'Hooks',    noun: 'a hook',    empty: 'No unresolved threads found yet.' },
    { key: 'factions',   cls: 'factions', title: 'Factions', noun: 'a faction', empty: 'No factions drawn from your story yet.' },
    { key: 'events',     cls: 'events',   title: 'Events',   noun: 'an event',  empty: 'No notable events found yet.' }
  ];

  useEffect(() => {
    if (character?.id) {
      fetchParsedBackstory();
    }
  }, [character?.id]);

  const fetchParsedBackstory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/character/${character.id}/parsed-backstory`);
      if (response.ok) {
        const data = await response.json();
        setParsedBackstory(data);
      } else if (response.status === 404) {
        setParsedBackstory(null);
      }
    } catch (err) {
      console.error('Failed to fetch parsed backstory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async (preserveManualEdits = false) => {
    try {
      setParsing(true);
      setError(null);
      const response = await fetch(`/api/character/${character.id}/parsed-backstory/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveManualEdits })
      });
      const data = await response.json();
      if (response.ok) {
        setParsedBackstory(data);
      } else {
        setError(data.error || 'Failed to parse backstory');
      }
    } catch (err) {
      setError('Failed to parse backstory');
    } finally {
      setParsing(false);
    }
  };

  const handleUpdateElement = async () => {
    if (!editingElement) return;
    try {
      const response = await fetch(
        `/api/character/${character.id}/parsed-backstory/${editingElement.type}/${editingElement.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm)
        }
      );
      const data = await response.json();
      if (response.ok) {
        setParsedBackstory(data);
        setEditingElement(null);
        setEditForm({});
      } else {
        setError(data.error || 'Failed to update element');
      }
    } catch (err) {
      setError('Failed to update element');
    }
  };

  const handleAddElement = async () => {
    if (!addingElement) return;
    try {
      const response = await fetch(
        `/api/character/${character.id}/parsed-backstory/${addingElement}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addForm)
        }
      );
      const data = await response.json();
      if (response.ok) {
        setParsedBackstory(data);
        setAddingElement(null);
        setAddForm({});
      } else {
        setError(data.error || 'Failed to add element');
      }
    } catch (err) {
      setError('Failed to add element');
    }
  };

  const handleRemoveElement = async (elementType, elementId) => {
    if (!confirm('Are you sure you want to remove this element?')) return;
    try {
      const response = await fetch(
        `/api/character/${character.id}/parsed-backstory/${elementType}/${elementId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (response.ok) {
        setParsedBackstory(data);
      } else {
        setError(data.error || 'Failed to remove element');
      }
    } catch (err) {
      setError('Failed to remove element');
    }
  };

  const startEditing = (type, element) => {
    setEditingElement({ type, id: element.id });
    setEditForm({ ...element });
  };

  const startAdding = (type) => {
    setAddingElement(type);
    setAddForm(getEmptyElement(type));
  };

  const getEmptyElement = (type) => {
    switch (type) {
      case 'characters':
        return { name: '', relationship: 'other', description: '', status: 'unknown' };
      case 'locations':
        return { name: '', type: 'significant', description: '' };
      case 'factions':
        return { name: '', relationship: 'neutral', description: '' };
      case 'events':
        return { title: '', description: '', timeframe: 'recent' };
      case 'story_hooks':
        return { title: '', description: '', category: 'other' };
      default:
        return {};
    }
  };

  const getTimeframeLabel = (timeframe) => {
    const labels = {
      before_birth: 'Before Birth',
      early_life: 'Early Life',
      formative_years: 'Formative Years',
      coming_of_age: 'Coming of Age',
      established: 'Established',
      recent: 'Recent',
      // Legacy support for old values
      childhood: 'Early Life',
      youth: 'Formative Years',
      adolescence: 'Coming of Age',
      adulthood: 'Established'
    };
    return labels[timeframe] || timeframe || 'Unknown';
  };

  const cap = (s) => (s == null || s === '') ? s : String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // word count for the manuscript header (real data, mirrors design's "186 words")
  const wordCount = character?.backstory
    ? character.backstory.trim().split(/\s+/).filter(Boolean).length
    : 0;

  // tone the chip on each parsed item by its relationship/category/timeframe
  const chipClass = (el) => {
    const enemyish = ['enemy', 'rival', 'wanted_by', 'former_member'];
    const r = el.relationship || el.type;
    if (el.relationship && enemyish.includes(el.relationship)) return 'chip bad';
    if (el.category || (el.type && el.type === 'significant')) return 'chip magic';
    return 'chip';
  };

  // the chip label shown on a parsed item (omit gracefully when absent)
  const chipLabel = (el) => {
    if (el.relationship) return cap(el.relationship);
    if (el.timeframe) return getTimeframeLabel(el.timeframe);
    if (el.category) return cap(el.category);
    if (el.type) return cap(el.type);
    return null;
  };

  // ─── early states ───
  if (loading) {
    return (
      <div className="hearth backstory app-bg">
        <HearthSprite />
        <header className="dash-hdr"><div className="wordmark">D<span className="amp">&amp;</span>D</div><div className="vr"></div><button className="back" onClick={onBack} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>← Home</button><div className="spacer"></div><span className="opus"><span className="dot"></span>Opus</span></header>
        <main className="page">
          <p className="help" style={{ textAlign: 'center', padding: '60px 0' }}>Reading your story…</p>
        </main>
      </div>
    );
  }

  if (!character?.backstory) {
    return (
      <div className="hearth backstory app-bg">
        <HearthSprite />
        <header className="dash-hdr"><div className="wordmark">D<span className="amp">&amp;</span>D</div><div className="vr"></div><button className="back" onClick={onBack} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>← Home</button><div className="spacer"></div><span className="opus"><span className="dot"></span>Opus</span></header>
        <main className="page">
          <div className="page-eyebrow"><span className="eyebrow">Backstory</span><span className="ln"></span></div>
          <div className="bs-empty">
            <div className="be-glyph">❧</div>
            <div className="be-t">No story written yet</div>
            <div className="be-s">Add a backstory in the Character Sheet, and the world will learn to read it.</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="hearth backstory app-bg">
      <HearthSprite />
      <header className="dash-hdr"><div className="wordmark">D<span className="amp">&amp;</span>D</div><div className="vr"></div><button className="back" onClick={onBack} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>← Home</button><div className="spacer"></div><span className="opus"><span className="dot"></span>Opus</span></header>

      <main className="page">
        <div className="page-eyebrow"><span className="eyebrow">Backstory</span><span className="ln"></span></div>
        <div className="sec-head">
          <h2>Your origin, as the world reads it</h2>
          <span className="glyph">❧</span>
          <span className="fl"></span>
          <span className="sub">People · Places · Hooks are woven into the campaign</span>
        </div>

        {parsedBackstory?.summary && (
          <p className="bs-summary">{parsedBackstory.summary}</p>
        )}

        {error && (
          <div className="bs-banner err"><Ic n="alert" />{error}</div>
        )}
        {parsedBackstory?.backstory_changed && (
          <div className="bs-banner warn">
            <Ic n="alert" />Your backstory has changed since it was last parsed. Re-parse to capture the updates.
          </div>
        )}

        <div className="bs-grid">
          {/* ── written manuscript ── */}
          <div className="manuscript">
            <div className="ms-head">
              <span className="t">As written</span>
              {wordCount > 0 && <span className="words">{wordCount} words</span>}
            </div>
            <div className="ms-body">{character.backstory}</div>
          </div>

          {/* ── parsed elements ── */}
          <div className="parsed">
            {!parsedBackstory ? (
              <div className="bs-empty">
                <div className="be-glyph">✶</div>
                <div className="be-t">Not yet parsed</div>
                <div className="be-s">
                  Let the table read your story — it will draw out the people, places, factions, events, and unresolved threads woven through it.
                </div>
                <button
                  className="btn primary lg"
                  onClick={() => handleParse(false)}
                  disabled={parsing}
                >
                  <Ic n="sparkles" />{parsing ? 'Reading…' : 'Read my story'}
                </button>
              </div>
            ) : (
              <>
                {groups.map(g => {
                  const items = parsedBackstory?.elements?.[g.key] || [];
                  return (
                    <div key={g.key} className={`pgroup ${g.cls}`}>
                      <div className="pg-head">
                        <span className="pg-dot"></span>
                        <span className="pg-t">{g.title}</span>
                        <span className="pg-ct">{items.length}</span>
                      </div>

                      {items.length === 0 ? (
                        <div className="pg-empty">{g.empty}</div>
                      ) : (
                        items.map(el => {
                          const label = chipLabel(el);
                          return (
                            <div
                              key={el.id}
                              className={`pitem${hoverId === el.id ? ' hl' : ''}`}
                              onMouseEnter={() => setHoverId(el.id)}
                              onMouseLeave={() => setHoverId(null)}
                            >
                              <div>
                                <div className="pn">{el.name || el.title}</div>
                                {el.description && <div className="pd">{el.description}</div>}
                                {el.notes && <div className="pd"><em>Note: {el.notes}</em></div>}
                                {label && (
                                  <div className="pmeta">
                                    <span className={chipClass(el)}>{label}</span>
                                    {el.status && el.status !== 'unknown' && (
                                      <span className={`chip${el.status === 'dead' ? ' bad' : ''}`}>{cap(el.status)}</span>
                                    )}
                                    {el.ai_generated === false && <span className="chip">Manual</span>}
                                  </div>
                                )}
                              </div>
                              <div className="pacts">
                                <button className="edit" title="Edit" onClick={() => startEditing(g.key, el)}><Ic n="pen" /></button>
                                <button className="edit danger" title="Remove" onClick={() => handleRemoveElement(g.key, el.id)}><Ic n="trash" /></button>
                              </div>
                            </div>
                          );
                        })
                      )}

                      <button className="pg-add" onClick={() => startAdding(g.key)}>
                        <Ic n="plus" />Add {g.noun}
                      </button>
                    </div>
                  );
                })}

                <div className="reparse">
                  <span className={`rt${parsedBackstory?.backstory_changed ? ' strong' : ''}`}>
                    {parsedBackstory?.backstory_changed ? 'Your story has changed.' : 'Edited your story?'}
                  </span>
                  <span className="spacer"></span>
                  <button className="btn sm" disabled={parsing} onClick={() => handleParse(true)}>
                    <Ic n="sparkles" />{parsing ? 'Re-reading…' : 'Re-parse · keep edits'}
                  </button>
                  <button className="btn ghost sm" disabled={parsing} onClick={() => handleParse(false)}>
                    <Ic n="refresh" />Fresh
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── Edit modal ── */}
      {editingElement && (
        <div className="scrim" onClick={() => setEditingElement(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Edit {cap(editingElement.type).replace(/s$/, '')}</h3></div>
            <div className="modal-body">
              {renderElementForm(editingElement.type, editForm, setEditForm, true)}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setEditingElement(null)}>Cancel</button>
              <button className="btn primary" onClick={handleUpdateElement}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add modal ── */}
      {addingElement && (
        <div className="scrim" onClick={() => setAddingElement(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Add {cap(addingElement).replace(/s$/, '')}</h3></div>
            <div className="modal-body">
              {renderElementForm(addingElement, addForm, setAddForm, false)}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setAddingElement(null)}>Cancel</button>
              <button className="btn primary" onClick={handleAddElement}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── element form (Hearth-styled fields; same field set as the original) ─── */
function renderElementForm(type, form, setForm, isEdit = false) {
  const updateForm = (field, value) => setForm({ ...form, [field]: value });
  const Notes = () => (
    <div className="field">
      <label className="label">Notes — your corrections</label>
      <textarea
        value={form.notes || ''}
        onChange={(e) => updateForm('notes', e.target.value)}
        placeholder="Add any corrections or additional notes…"
      />
    </div>
  );

  switch (type) {
    case 'characters':
      return (
        <>
          <div className="field">
            <label className="label">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => updateForm('name', e.target.value)} placeholder="Character name" />
          </div>
          <div className="field">
            <label className="label">Relationship</label>
            <select value={form.relationship || 'other'} onChange={(e) => updateForm('relationship', e.target.value)}>
              <option value="family">Family</option>
              <option value="mentor">Mentor</option>
              <option value="friend">Friend</option>
              <option value="enemy">Enemy</option>
              <option value="rival">Rival</option>
              <option value="romantic">Romantic</option>
              <option value="acquaintance">Acquaintance</option>
              <option value="employer">Employer</option>
              <option value="servant">Servant</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Status</label>
            <select value={form.status || 'unknown'} onChange={(e) => updateForm('status', e.target.value)}>
              <option value="alive">Alive</option>
              <option value="dead">Dead</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea value={form.description || ''} onChange={(e) => updateForm('description', e.target.value)} placeholder="Brief description of this character and their connection…" />
          </div>
          {isEdit && <Notes />}
        </>
      );

    case 'locations':
      return (
        <>
          <div className="field">
            <label className="label">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => updateForm('name', e.target.value)} placeholder="Location name" />
          </div>
          <div className="field">
            <label className="label">Type</label>
            <select value={form.type || 'significant'} onChange={(e) => updateForm('type', e.target.value)}>
              <option value="hometown">Hometown</option>
              <option value="birthplace">Birthplace</option>
              <option value="workplace">Workplace</option>
              <option value="visited">Visited</option>
              <option value="significant">Significant</option>
              <option value="current">Current</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea value={form.description || ''} onChange={(e) => updateForm('description', e.target.value)} placeholder="Why is this place significant?" />
          </div>
          {isEdit && <Notes />}
        </>
      );

    case 'factions':
      return (
        <>
          <div className="field">
            <label className="label">Name</label>
            <input type="text" value={form.name || ''} onChange={(e) => updateForm('name', e.target.value)} placeholder="Organization/faction name" />
          </div>
          <div className="field">
            <label className="label">Relationship</label>
            <select value={form.relationship || 'neutral'} onChange={(e) => updateForm('relationship', e.target.value)}>
              <option value="member">Member</option>
              <option value="former_member">Former Member</option>
              <option value="ally">Ally</option>
              <option value="enemy">Enemy</option>
              <option value="neutral">Neutral</option>
              <option value="wanted_by">Wanted By</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea value={form.description || ''} onChange={(e) => updateForm('description', e.target.value)} placeholder="Your connection to this organization…" />
          </div>
          {isEdit && <Notes />}
        </>
      );

    case 'events':
      return (
        <>
          <div className="field">
            <label className="label">Title</label>
            <input type="text" value={form.title || ''} onChange={(e) => updateForm('title', e.target.value)} placeholder="Event title" />
          </div>
          <div className="field">
            <label className="label">Timeframe</label>
            <select value={form.timeframe || 'unknown'} onChange={(e) => updateForm('timeframe', e.target.value)}>
              <option value="before_birth">Before Birth (family history)</option>
              <option value="early_life">Early Life</option>
              <option value="formative_years">Formative Years</option>
              <option value="coming_of_age">Coming of Age</option>
              <option value="established">Established (pre-adventuring)</option>
              <option value="recent">Recent</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea value={form.description || ''} onChange={(e) => updateForm('description', e.target.value)} placeholder="What happened and why it matters…" />
          </div>
          {isEdit && <Notes />}
        </>
      );

    case 'story_hooks':
      return (
        <>
          <div className="field">
            <label className="label">Title</label>
            <input type="text" value={form.title || ''} onChange={(e) => updateForm('title', e.target.value)} placeholder="Hook title" />
          </div>
          <div className="field">
            <label className="label">Category</label>
            <select value={form.category || 'other'} onChange={(e) => updateForm('category', e.target.value)}>
              <option value="revenge">Revenge</option>
              <option value="mystery">Mystery</option>
              <option value="debt">Debt</option>
              <option value="promise">Promise</option>
              <option value="quest">Quest</option>
              <option value="goal">Goal</option>
              <option value="relationship">Relationship</option>
              <option value="secret">Secret</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Description</label>
            <textarea value={form.description || ''} onChange={(e) => updateForm('description', e.target.value)} placeholder="Describe the unresolved thread or potential story…" />
          </div>
          {isEdit && <Notes />}
        </>
      );

    default:
      return null;
  }
}
