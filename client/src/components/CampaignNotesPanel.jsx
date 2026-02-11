import { useState } from 'react';

const CampaignNotesPanel = ({
  campaignNotes,
  myNotes,
  characterMemories,
  notesTab,
  sessionHistory,
  onClose,
  onTabChange,
  onSaveNotes,
  onGenerateNotes,
  onMyNotesChange,
  notesSaving,
  notesGenerating,
  notesLoading
}) => {

  // Parse campaign notes into AI section and My Notes section
  const parseNotesIntoSections = (notes) => {
    if (!notes) return { aiNotes: '', myNotes: '' };

    // Look for the My Notes section
    const myNotesPatterns = [
      /\n---\n## My Notes\n/i,
      /\n## My Notes\n/i
    ];

    for (const pattern of myNotesPatterns) {
      const match = notes.search(pattern);
      if (match !== -1) {
        const aiSection = notes.substring(0, match).trim();
        const mySection = notes.substring(match).replace(/^[\s\S]*?## My Notes\n/, '').replace(/^\*[^*]+\*\n*/, '').trim();
        return { aiNotes: aiSection, myNotes: mySection };
      }
    }

    // No My Notes section found - everything is AI notes
    return { aiNotes: notes.trim(), myNotes: '' };
  };

  // Reconstruct full notes from sections
  const reconstructNotes = (aiNotes, myNotesContent) => {
    let result = aiNotes.trim();
    result += '\n\n---\n## My Notes\n*Your personal additions - this section is preserved when regenerating*\n\n';
    result += myNotesContent.trim();
    return result;
  };

  const { aiNotes, myNotes: parsedMyNotes } = parseNotesIntoSections(campaignNotes);

  // Update myNotes state when switching to mynotes tab if not already set
  const currentMyNotes = myNotes || parsedMyNotes;

  const handleMyNotesChange = (newMyNotes) => {
    onMyNotesChange(newMyNotes, reconstructNotes(aiNotes, newMyNotes));
  };

  return (
    <div className="dm-session-container">
      <div className="dm-session-header">
        <button className="back-btn" onClick={() => { onClose(); onTabChange('history'); }}>&larr; Back</button>
        <h2>Campaign Reference</h2>
        {notesTab === 'mynotes' && (
          <button
            onClick={onSaveNotes}
            disabled={notesSaving}
            style={{
              background: 'rgba(46, 204, 113, 0.2)',
              border: '1px solid #2ecc71',
              color: '#2ecc71',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: notesSaving ? 'wait' : 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        marginBottom: '1rem'
      }}>
        <button
          onClick={() => onTabChange('history')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: notesTab === 'history' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: notesTab === 'history' ? '2px solid #3b82f6' : '2px solid transparent',
            color: notesTab === 'history' ? '#60a5fa' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: notesTab === 'history' ? 'bold' : 'normal'
          }}
        >
          Session Recaps
        </button>
        <button
          onClick={() => onTabChange('memory')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: notesTab === 'memory' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: notesTab === 'memory' ? '2px solid #8b5cf6' : '2px solid transparent',
            color: notesTab === 'memory' ? '#a78bfa' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: notesTab === 'memory' ? 'bold' : 'normal'
          }}
        >
          AI Memory
        </button>
        <button
          onClick={() => { onTabChange('mynotes'); }}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: notesTab === 'mynotes' ? 'rgba(46, 204, 113, 0.2)' : 'transparent',
            border: 'none',
            borderBottom: notesTab === 'mynotes' ? '2px solid #2ecc71' : '2px solid transparent',
            color: notesTab === 'mynotes' ? '#2ecc71' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: notesTab === 'mynotes' ? 'bold' : 'normal'
          }}
        >
          My Notes
        </button>
      </div>

      <div style={{ padding: '0 1rem 1rem 1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

        {/* Session History Tab */}
        {notesTab === 'history' && (
          <>
            <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>
              Recaps from your previous sessions. Use these to remember what happened.
            </p>
            {sessionHistory.length === 0 ? (
              <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No completed sessions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sessionHistory.slice().reverse().map((session, idx) => (
                  <div key={session.id} style={{
                    padding: '1rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#60a5fa', marginBottom: '0.5rem' }}>
                      Session {sessionHistory.length - idx}: {session.title}
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {session.summary || 'No summary available.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* AI Memory Tab (read-only) */}
        {notesTab === 'memory' && (
          <>
            <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>
              AI-generated campaign memory. This is included in every session to help the AI remember your story.
              <span style={{ color: '#f59e0b' }}> (Read-only - use "My Notes" tab to add your own.)</span>
            </p>

            {/* Generate from history button */}
            {sessionHistory.length > 0 && (
              <button
                onClick={onGenerateNotes}
                disabled={notesGenerating || notesLoading}
                style={{
                  width: '100%',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  background: notesGenerating
                    ? 'rgba(139, 92, 246, 0.1)'
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                  color: '#a78bfa',
                  cursor: notesGenerating ? 'wait' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {notesGenerating ? (
                  <span className="loading-dots">Analyzing {sessionHistory.length} session(s)...</span>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Regenerate from Past Adventures ({sessionHistory.length} sessions)</span>
                  </>
                )}
              </button>
            )}

            {notesLoading ? (
              <p>Loading notes...</p>
            ) : (
              <div style={{
                padding: '1rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                minHeight: '200px'
              }}>
                {aiNotes || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No AI memory yet. Complete a session or click "Regenerate" above.</span>}
              </div>
            )}

            {/* Character Personality Memories */}
            {characterMemories && characterMemories.trim().length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{
                  color: '#f59e0b',
                  fontSize: '0.95rem',
                  marginBottom: '0.75rem',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: '1rem'
                }}>
                  Character Personality
                </h3>
                <p style={{ marginBottom: '0.75rem', opacity: 0.7, fontSize: '0.85rem' }}>
                  Personality traits the AI has observed during your adventures. These persist permanently and evolve as your character grows.
                </p>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {characterMemories}
                </div>
              </div>
            )}
          </>
        )}

        {/* My Notes Tab (editable) */}
        {notesTab === 'mynotes' && (
          <>
            <p style={{ marginBottom: '1rem', opacity: 0.8, fontSize: '0.9rem' }}>
              Your personal notes. Add corrections, reminders, or details the AI might have missed.
              <span style={{ color: '#2ecc71' }}> These are preserved when you regenerate AI memory.</span>
            </p>

            <textarea
              value={currentMyNotes}
              onChange={(e) => handleMyNotesChange(e.target.value)}
              placeholder="Add your own notes here...

Examples:
- Captain Morris (not Tobias) sent scouts to check the settlements
- We agreed to leave PRE-DAWN to scout the bandit camp
- Jakob's motivation: proving himself to the church
- Shanion seems interested in herbal remedies - could be a plot hook"
              style={{
                width: '100%',
                minHeight: '300px',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid rgba(46, 204, 113, 0.3)',
                background: 'rgba(0,0,0,0.3)',
                color: 'inherit',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                resize: 'vertical'
              }}
            />

            <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
              <strong>Tips:</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                <li>Correct AI mistakes: "Captain Morris sent the scouts, NOT Tobias"</li>
                <li>Note specific plans: "We agreed to leave at pre-dawn"</li>
                <li>Track NPC details: "Jakob is motivated by proving himself"</li>
                <li>Record items given away: "Gave the merchant our spare rope"</li>
              </ul>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default CampaignNotesPanel;
