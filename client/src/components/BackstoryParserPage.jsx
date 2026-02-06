import { useState, useEffect } from 'react';

export default function BackstoryParserPage({ character, onCharacterUpdated }) {
  const [parsedBackstory, setParsedBackstory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('characters');
  const [editingElement, setEditingElement] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addingElement, setAddingElement] = useState(null);
  const [addForm, setAddForm] = useState({});

  const tabs = [
    { key: 'characters', label: 'Characters', icon: '👤' },
    { key: 'locations', label: 'Locations', icon: '📍' },
    { key: 'factions', label: 'Factions', icon: '⚔️' },
    { key: 'events', label: 'Events', icon: '📜' },
    { key: 'story_hooks', label: 'Story Hooks', icon: '🎣' }
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

  const getRelationshipColor = (relationship) => {
    const colors = {
      family: '#e74c3c',
      mentor: '#9b59b6',
      friend: '#27ae60',
      enemy: '#c0392b',
      rival: '#e67e22',
      romantic: '#e91e63',
      acquaintance: '#3498db',
      member: '#27ae60',
      former_member: '#7f8c8d',
      ally: '#2ecc71',
      wanted_by: '#c0392b',
      neutral: '#95a5a6'
    };
    return colors[relationship] || '#95a5a6';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'alive': return '💚';
      case 'dead': return '💀';
      default: return '❓';
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

  const getTimeframeColor = (timeframe) => {
    const colors = {
      before_birth: '#8e44ad',
      early_life: '#3498db',
      formative_years: '#2ecc71',
      coming_of_age: '#f39c12',
      established: '#e67e22',
      recent: '#e74c3c',
      // Legacy support
      childhood: '#3498db',
      youth: '#2ecc71',
      adolescence: '#f39c12',
      adulthood: '#e67e22'
    };
    return colors[timeframe] || '#95a5a6';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      revenge: '⚔️',
      mystery: '🔍',
      debt: '💰',
      promise: '🤝',
      quest: '📜',
      goal: '🎯',
      relationship: '💕',
      secret: '🤫'
    };
    return icons[category] || '📌';
  };

  const styles = {
    container: {
      display: 'flex',
      height: 'calc(100vh - 120px)',
      gap: '20px',
      padding: '20px'
    },
    leftPanel: {
      width: '350px',
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '15px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    },
    rightPanel: {
      flex: 1,
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '20px',
      overflowY: 'auto'
    },
    sectionTitle: {
      color: '#9b59b6',
      fontSize: '18px',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    backstoryText: {
      color: '#bdc3c7',
      lineHeight: '1.8',
      whiteSpace: 'pre-wrap',
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      fontSize: '14px',
      flex: 1,
      overflowY: 'auto'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '20px',
      borderBottom: '1px solid #34495e',
      paddingBottom: '10px',
      flexWrap: 'wrap'
    },
    tab: {
      padding: '8px 14px',
      backgroundColor: '#34495e',
      border: 'none',
      borderRadius: '4px',
      color: '#ecf0f1',
      cursor: 'pointer',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    tabActive: {
      backgroundColor: '#9b59b6'
    },
    tabCount: {
      backgroundColor: 'rgba(0,0,0,0.3)',
      padding: '2px 6px',
      borderRadius: '10px',
      fontSize: '11px'
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px'
    },
    button: {
      padding: '8px 16px',
      backgroundColor: '#9b59b6',
      border: 'none',
      borderRadius: '4px',
      color: 'white',
      cursor: 'pointer',
      fontSize: '14px'
    },
    buttonSmall: {
      padding: '4px 10px',
      fontSize: '12px'
    },
    buttonDanger: {
      backgroundColor: '#c0392b'
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    elementCard: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '12px',
      borderLeft: '4px solid #9b59b6'
    },
    elementHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '8px'
    },
    elementName: {
      fontWeight: 'bold',
      color: '#ecf0f1',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    elementBadge: {
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '10px',
      textTransform: 'uppercase'
    },
    elementDescription: {
      color: '#bdc3c7',
      fontSize: '14px',
      lineHeight: '1.6'
    },
    elementActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '10px'
    },
    aiTag: {
      fontSize: '10px',
      color: '#7f8c8d',
      marginLeft: '8px'
    },
    manualTag: {
      fontSize: '10px',
      color: '#27ae60',
      marginLeft: '8px'
    },
    notesSection: {
      marginTop: '10px',
      padding: '8px',
      backgroundColor: 'rgba(155, 89, 182, 0.1)',
      borderRadius: '4px',
      fontSize: '13px',
      color: '#bdc3c7'
    },
    emptyState: {
      textAlign: 'center',
      color: '#7f8c8d',
      padding: '40px',
      fontSize: '16px'
    },
    loadingState: {
      textAlign: 'center',
      color: '#9b59b6',
      padding: '40px'
    },
    error: {
      backgroundColor: '#c0392b',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '15px'
    },
    warning: {
      backgroundColor: 'rgba(243, 156, 18, 0.2)',
      border: '1px solid #f39c12',
      color: '#f39c12',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '15px',
      fontSize: '14px'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      backgroundColor: '#2c3e50',
      padding: '25px',
      borderRadius: '8px',
      width: '500px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      overflowY: 'auto'
    },
    modalTitle: {
      color: '#9b59b6',
      fontSize: '18px',
      marginBottom: '20px'
    },
    formGroup: {
      marginBottom: '15px'
    },
    label: {
      display: 'block',
      color: '#bdc3c7',
      marginBottom: '5px',
      fontSize: '14px'
    },
    input: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#34495e',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px'
    },
    textarea: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#34495e',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px',
      minHeight: '100px',
      resize: 'vertical'
    },
    select: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#34495e',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px'
    },
    modalActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
      marginTop: '20px'
    },
    summary: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '20px',
      borderLeft: '4px solid #9b59b6'
    },
    summaryText: {
      color: '#ecf0f1',
      fontStyle: 'italic',
      lineHeight: '1.6'
    }
  };

  const renderElementForm = (type, form, setForm, isEdit = false) => {
    const updateForm = (field, value) => setForm({ ...form, [field]: value });

    switch (type) {
      case 'characters':
        return (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                style={styles.input}
                value={form.name || ''}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Character name"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Relationship</label>
              <select
                style={styles.select}
                value={form.relationship || 'other'}
                onChange={(e) => updateForm('relationship', e.target.value)}
              >
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
            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.select}
                value={form.status || 'unknown'}
                onChange={(e) => updateForm('status', e.target.value)}
              >
                <option value="alive">Alive</option>
                <option value="dead">Dead</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Brief description of this character and their connection..."
              />
            </div>
            {isEdit && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes (your corrections/additions)</label>
                <textarea
                  style={styles.textarea}
                  value={form.notes || ''}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Add any corrections or additional notes..."
                />
              </div>
            )}
          </>
        );

      case 'locations':
        return (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                style={styles.input}
                value={form.name || ''}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Location name"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Type</label>
              <select
                style={styles.select}
                value={form.type || 'significant'}
                onChange={(e) => updateForm('type', e.target.value)}
              >
                <option value="hometown">Hometown</option>
                <option value="birthplace">Birthplace</option>
                <option value="workplace">Workplace</option>
                <option value="visited">Visited</option>
                <option value="significant">Significant</option>
                <option value="current">Current</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Why is this place significant?"
              />
            </div>
            {isEdit && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  style={styles.textarea}
                  value={form.notes || ''}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Add any corrections..."
                />
              </div>
            )}
          </>
        );

      case 'factions':
        return (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                style={styles.input}
                value={form.name || ''}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="Organization/faction name"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Relationship</label>
              <select
                style={styles.select}
                value={form.relationship || 'neutral'}
                onChange={(e) => updateForm('relationship', e.target.value)}
              >
                <option value="member">Member</option>
                <option value="former_member">Former Member</option>
                <option value="ally">Ally</option>
                <option value="enemy">Enemy</option>
                <option value="neutral">Neutral</option>
                <option value="wanted_by">Wanted By</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Your connection to this organization..."
              />
            </div>
            {isEdit && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  style={styles.textarea}
                  value={form.notes || ''}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Add any corrections..."
                />
              </div>
            )}
          </>
        );

      case 'events':
        return (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Title</label>
              <input
                type="text"
                style={styles.input}
                value={form.title || ''}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Event title"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Timeframe</label>
              <select
                style={styles.select}
                value={form.timeframe || 'unknown'}
                onChange={(e) => updateForm('timeframe', e.target.value)}
              >
                <option value="before_birth">Before Birth (family history)</option>
                <option value="early_life">Early Life</option>
                <option value="formative_years">Formative Years</option>
                <option value="coming_of_age">Coming of Age</option>
                <option value="established">Established (pre-adventuring)</option>
                <option value="recent">Recent</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="What happened and why it matters..."
              />
            </div>
            {isEdit && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  style={styles.textarea}
                  value={form.notes || ''}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Add any corrections..."
                />
              </div>
            )}
          </>
        );

      case 'story_hooks':
        return (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>Title</label>
              <input
                type="text"
                style={styles.input}
                value={form.title || ''}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="Hook title"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <select
                style={styles.select}
                value={form.category || 'other'}
                onChange={(e) => updateForm('category', e.target.value)}
              >
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
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={styles.textarea}
                value={form.description || ''}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Describe the unresolved thread or potential story..."
              />
            </div>
            {isEdit && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  style={styles.textarea}
                  value={form.notes || ''}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Add any corrections..."
                />
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const renderElements = () => {
    const elements = parsedBackstory?.elements?.[activeTab] || [];

    if (elements.length === 0) {
      return (
        <div style={styles.emptyState}>
          No {activeTab.replace('_', ' ')} found in backstory
          <br />
          <button
            style={{ ...styles.button, marginTop: '15px' }}
            onClick={() => startAdding(activeTab)}
          >
            + Add Manually
          </button>
        </div>
      );
    }

    return elements.map(element => (
      <div
        key={element.id}
        style={{
          ...styles.elementCard,
          borderLeftColor: element.relationship
            ? getRelationshipColor(element.relationship)
            : element.timeframe
              ? getTimeframeColor(element.timeframe)
              : '#9b59b6'
        }}
      >
        <div style={styles.elementHeader}>
          <div style={styles.elementName}>
            {element.name || element.title}
            {element.status && <span>{getStatusIcon(element.status)}</span>}
            {element.category && <span>{getCategoryIcon(element.category)}</span>}
            {element.ai_generated ? (
              <span style={styles.aiTag}>(AI)</span>
            ) : (
              <span style={styles.manualTag}>(Manual)</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {element.relationship && (
              <span
                style={{
                  ...styles.elementBadge,
                  backgroundColor: getRelationshipColor(element.relationship),
                  color: 'white'
                }}
              >
                {element.relationship.replace('_', ' ')}
              </span>
            )}
            {element.type && !element.relationship && (
              <span
                style={{
                  ...styles.elementBadge,
                  backgroundColor: getRelationshipColor(element.type),
                  color: 'white'
                }}
              >
                {element.type.replace('_', ' ')}
              </span>
            )}
            {element.timeframe && (
              <span
                style={{
                  ...styles.elementBadge,
                  backgroundColor: getTimeframeColor(element.timeframe),
                  color: 'white'
                }}
              >
                {getTimeframeLabel(element.timeframe)}
              </span>
            )}
            {element.category && !element.timeframe && (
              <span
                style={{
                  ...styles.elementBadge,
                  backgroundColor: '#9b59b6',
                  color: 'white'
                }}
              >
                {element.category.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
        <div style={styles.elementDescription}>{element.description}</div>
        {element.notes && (
          <div style={styles.notesSection}>
            <strong>Notes:</strong> {element.notes}
          </div>
        )}
        <div style={styles.elementActions}>
          <button
            style={{ ...styles.button, ...styles.buttonSmall }}
            onClick={() => startEditing(activeTab, element)}
          >
            Edit
          </button>
          <button
            style={{ ...styles.button, ...styles.buttonSmall, ...styles.buttonDanger }}
            onClick={() => handleRemoveElement(activeTab, element.id)}
          >
            Remove
          </button>
        </div>
      </div>
    ));
  };

  if (loading) {
    return <div style={styles.loadingState}>Loading...</div>;
  }

  if (!character?.backstory) {
    return (
      <div style={styles.emptyState}>
        <p>This character has no backstory yet.</p>
        <p style={{ marginTop: '10px', color: '#7f8c8d', fontSize: '14px' }}>
          Add a backstory in the Character Sheet to use the parser.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Left Panel - Raw Backstory */}
      <div style={styles.leftPanel}>
        <div style={styles.sectionTitle}>📖 Raw Backstory</div>
        <div style={styles.backstoryText}>
          {character.backstory || 'No backstory entered'}
        </div>
        <div style={{ marginTop: '15px' }}>
          {!parsedBackstory ? (
            <button
              style={{ ...styles.button, width: '100%', ...(parsing ? styles.buttonDisabled : {}) }}
              onClick={() => handleParse(false)}
              disabled={parsing}
            >
              {parsing ? 'Parsing...' : '🔮 Parse Backstory with AI'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                style={{ ...styles.button, width: '100%', ...(parsing ? styles.buttonDisabled : {}) }}
                onClick={() => handleParse(true)}
                disabled={parsing}
              >
                {parsing ? 'Parsing...' : '🔄 Re-parse (Keep Edits)'}
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonDanger, width: '100%', ...(parsing ? styles.buttonDisabled : {}) }}
                onClick={() => handleParse(false)}
                disabled={parsing}
              >
                {parsing ? 'Parsing...' : '🔄 Re-parse (Fresh Start)'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Parsed Elements */}
      <div style={styles.rightPanel}>
        {error && <div style={styles.error}>{error}</div>}

        {parsedBackstory?.backstory_changed && (
          <div style={styles.warning}>
            ⚠️ Your backstory has changed since it was last parsed. Consider re-parsing to capture updates.
          </div>
        )}

        {!parsedBackstory ? (
          <div style={styles.emptyState}>
            <p>Click "Parse Backstory with AI" to extract characters, locations, factions, events, and story hooks from your backstory.</p>
          </div>
        ) : (
          <>
            {parsedBackstory.summary && (
              <div style={styles.summary}>
                <div style={styles.summaryText}>{parsedBackstory.summary}</div>
              </div>
            )}

            <div style={styles.tabs}>
              {tabs.map(tab => {
                const count = parsedBackstory?.elements?.[tab.key]?.length || 0;
                return (
                  <button
                    key={tab.key}
                    style={{
                      ...styles.tab,
                      ...(activeTab === tab.key ? styles.tabActive : {})
                    }}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.icon} {tab.label}
                    <span style={styles.tabCount}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={styles.headerRow}>
              <div style={{ color: '#ecf0f1', fontSize: '16px' }}>
                {tabs.find(t => t.key === activeTab)?.icon} {tabs.find(t => t.key === activeTab)?.label}
              </div>
              <button
                style={{ ...styles.button, ...styles.buttonSmall }}
                onClick={() => startAdding(activeTab)}
              >
                + Add
              </button>
            </div>

            {renderElements()}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingElement && (
        <div style={styles.modal} onClick={() => setEditingElement(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Edit {activeTab.replace('_', ' ').slice(0, -1)}</div>
            {renderElementForm(editingElement.type, editForm, setEditForm, true)}
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.button, backgroundColor: '#7f8c8d' }}
                onClick={() => setEditingElement(null)}
              >
                Cancel
              </button>
              <button style={styles.button} onClick={handleUpdateElement}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addingElement && (
        <div style={styles.modal} onClick={() => setAddingElement(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add {addingElement.replace('_', ' ').slice(0, -1)}</div>
            {renderElementForm(addingElement, addForm, setAddForm, false)}
            <div style={styles.modalActions}>
              <button
                style={{ ...styles.button, backgroundColor: '#7f8c8d' }}
                onClick={() => setAddingElement(null)}
              >
                Cancel
              </button>
              <button style={styles.button} onClick={handleAddElement}>
                Add Element
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
