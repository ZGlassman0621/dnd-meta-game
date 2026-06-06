// Campaign reference / notes — Hearth right-side slide-in panel.
// Restyled from the legacy full-screen `.dm-session-container` takeover to match
// QuickReferencePanel's `.panel-scrim` + `aside.pnl.open` slide-in structure so it
// layers over the cockpit instead of trapping the player on a separate screen.
// Self-wrapped in `.hearth` so the scoped `.pnl` styles apply wherever it mounts.

// Local inline sprite — symbol paths kept local so we never touch the shared HearthSprite.
function CNSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="cn-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </symbol>
        <symbol id="cn-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </symbol>
        <symbol id="cn-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
        </symbol>
      </defs>
    </svg>
  );
}

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

  const subLabel = notesTab === 'history' ? 'Session recaps'
    : notesTab === 'memory' ? 'AI memory'
    : 'My notes';

  return (
    <div className="hearth">
      <CNSprite />
      <div className="panel-scrim show" onClick={() => { onClose(); onTabChange('history'); }} />
      <aside className="pnl open" data-panel="notes">
        <div className="pnl-head">
          <svg className="ph-ic2"><use href="#cn-pen" /></svg>
          <h3>Campaign reference</h3>
          <span className="ph-sub2">{subLabel}</span>
          <button
            className="pnl-close"
            onClick={() => { onClose(); onTabChange('history'); }}
            aria-label="Close"
          >
            <svg className="ic"><use href="#cn-x" /></svg>
          </button>
        </div>

        {/* Tabs — quiet Hearth segmented control */}
        <div className="cn-seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={notesTab === 'history'}
            className={`cn-seg-btn${notesTab === 'history' ? ' active' : ''}`}
            onClick={() => onTabChange('history')}
          >
            Recaps
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={notesTab === 'memory'}
            className={`cn-seg-btn${notesTab === 'memory' ? ' active' : ''}`}
            onClick={() => onTabChange('memory')}
          >
            AI memory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={notesTab === 'mynotes'}
            className={`cn-seg-btn${notesTab === 'mynotes' ? ' active' : ''}`}
            onClick={() => { onTabChange('mynotes'); }}
          >
            My notes
          </button>
        </div>

        <div className="pnl-body scroll">

          {/* Session History Tab */}
          {notesTab === 'history' && (
            <>
              <p className="cn-lede">
                Recaps from your previous sessions. Use these to remember what happened.
              </p>
              {sessionHistory.length === 0 ? (
                <p className="cn-empty">No completed sessions yet.</p>
              ) : (
                <div className="cn-recaps">
                  {sessionHistory.slice().reverse().map((session, idx) => (
                    <div className="cn-recap" key={session.id}>
                      <div className="cn-recap-ttl">
                        Session {sessionHistory.length - idx}: {session.title}
                      </div>
                      <div className="cn-recap-body">
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
              <p className="cn-lede">
                AI-generated campaign memory. This is included in every session to help the AI remember your story.
                <span className="cn-note-warn"> Read-only — use the My notes tab to add your own.</span>
              </p>

              {/* Generate from history button */}
              {sessionHistory.length > 0 && (
                <button
                  className="btn cn-regen"
                  onClick={onGenerateNotes}
                  disabled={notesGenerating || notesLoading}
                >
                  {notesGenerating ? (
                    <span className="loading-dots">Analyzing {sessionHistory.length} session(s)...</span>
                  ) : (
                    <>
                      <svg className="ic"><use href="#cn-sparkle" /></svg>
                      <span>Regenerate from past adventures ({sessionHistory.length})</span>
                    </>
                  )}
                </button>
              )}

              {notesLoading ? (
                <p className="cn-lede">Loading notes...</p>
              ) : (
                <div className="cn-memory">
                  {aiNotes || <span className="cn-memory-empty">No AI memory yet. Complete a session or click Regenerate above.</span>}
                </div>
              )}

              {/* Character Personality Memories */}
              {characterMemories && characterMemories.trim().length > 0 && (
                <>
                  <div className="pnl-sec">Character personality<span className="ln"></span></div>
                  <p className="cn-lede">
                    Personality traits the AI has observed during your adventures. These persist permanently and evolve as your character grows.
                  </p>
                  <div className="cn-memory accent">
                    {characterMemories}
                  </div>
                </>
              )}
            </>
          )}

          {/* My Notes Tab (editable) */}
          {notesTab === 'mynotes' && (
            <>
              <p className="cn-lede">
                Your personal notes. Add corrections, reminders, or details the AI might have missed.
                <span className="cn-note-good"> These are preserved when you regenerate AI memory.</span>
              </p>

              <textarea
                className="notes-area"
                value={currentMyNotes}
                onChange={(e) => handleMyNotesChange(e.target.value)}
                placeholder="Add your own notes here...

Examples:
- Captain Morris (not Tobias) sent scouts to check the settlements
- We agreed to leave PRE-DAWN to scout the bandit camp
- Jakob's motivation: proving himself to the church
- Shanion seems interested in herbal remedies - could be a plot hook"
              />

              <div className="cn-tips">
                <div className="cn-tips-ttl">Tips</div>
                <ul>
                  <li>Correct AI mistakes: "Captain Morris sent the scouts, NOT Tobias"</li>
                  <li>Note specific plans: "We agreed to leave at pre-dawn"</li>
                  <li>Track NPC details: "Jakob is motivated by proving himself"</li>
                  <li>Record items given away: "Gave the merchant our spare rope"</li>
                </ul>
              </div>
            </>
          )}

        </div>

        {/* Save — Hearth primary button, only on the editable tab */}
        {notesTab === 'mynotes' && (
          <div className="pnl-foot">
            <button
              className="btn primary"
              onClick={onSaveNotes}
              disabled={notesSaving}
            >
              {notesSaving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export default CampaignNotesPanel;
