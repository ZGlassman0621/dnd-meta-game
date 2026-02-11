import React from 'react';

const formatGold = (gold) => {
  if (!gold) return '0';
  const parts = [];
  if (gold.gp) parts.push(`${gold.gp} gp`);
  if (gold.sp) parts.push(`${gold.sp} sp`);
  if (gold.cp) parts.push(`${gold.cp} cp`);
  return parts.join(', ') || '0';
};

function SessionRewards({
  sessionSummary,
  sessionRewards,
  hpChange,
  inventoryChanges,
  inventoryApplied,
  preInventorySnapshot,
  extractedNpcs,
  onClaimRewards,
  onApplyInventory,
  onUndoInventory,
  isLoading,
  character,
  messages,
  error
}) {
  return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <h2>Adventure Complete!</h2>
        </div>

        <div className="dm-messages" style={{ flex: 'none', maxHeight: '200px' }}>
          {messages.slice(-3).map((msg, idx) => (
            <div key={idx} className={`dm-message ${msg.type}`}>
              {msg.type === 'action' && <span className="action-label">{character.name}:</span>}
              {msg.type === 'summary' && <span className="summary-label">Adventure Summary:</span>}
              <p>{msg.content}</p>
            </div>
          ))}
        </div>

        <div className="rewards-container">
          <h3>Session Rewards</h3>

          <div className="rewards-grid">
            <div className="reward-item">
              <span className="reward-label">Experience</span>
              <span className="reward-value xp">+{sessionRewards?.xp || 0} XP</span>
            </div>

            <div className="reward-item">
              <span className="reward-label">Gold</span>
              <span className="reward-value gold">{formatGold(sessionRewards?.gold)}</span>
            </div>

            <div className="reward-item">
              <span className="reward-label">Health</span>
              <span className={`reward-value ${hpChange >= 0 ? 'heal' : 'damage'}`}>
                {hpChange >= 0 ? '+' : ''}{hpChange} HP
              </span>
            </div>

            {sessionRewards?.loot && (
              <div className="reward-item loot">
                <span className="reward-label">Loot Found</span>
                <span className="reward-value">{sessionRewards.loot}</span>
              </div>
            )}
          </div>

          {/* XP Breakdown Section */}
          {sessionRewards?.breakdown?.categories && (
            <div className="xp-breakdown" style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#60a5fa' }}>
                XP Breakdown
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                {sessionRewards.breakdown.categories.combat.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ef4444' }}>Combat</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.combat.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.exploration.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#22c55e' }}>Exploration</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.exploration.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.quests.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#f59e0b' }}>Quests</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.quests.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.discovery.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#a78bfa' }}>Discovery</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.discovery.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.categories.social.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ec4899' }}>Social</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.categories.social.xp} XP</span>
                  </div>
                )}
                {sessionRewards.breakdown.dangerBonus?.xp > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ color: '#f97316' }}>Danger Bonus</span>
                    <span style={{ color: '#e0e0e0' }}>+{sessionRewards.breakdown.dangerBonus.xp} XP</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inventory Changes Section */}
          {inventoryChanges && (inventoryChanges.consumed?.length > 0 || inventoryChanges.gained?.length > 0 ||
            (inventoryChanges.goldSpent && (inventoryChanges.goldSpent.gp > 0 || inventoryChanges.goldSpent.sp > 0 || inventoryChanges.goldSpent.cp > 0))) && (
            <div className="inventory-changes" style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#a78bfa' }}>
                📦 Inventory Changes {inventoryApplied && <span style={{ color: '#10b981' }}>✓ Auto-applied</span>}
                {!inventoryApplied && !preInventorySnapshot && <span style={{ color: '#f59e0b' }}> ↩ Undone</span>}
              </h4>

              {inventoryChanges.consumed?.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#ef4444' }}>Used: </span>
                  <span style={{ color: '#e0e0e0' }}>{inventoryChanges.consumed.join(', ')}</span>
                </div>
              )}

              {inventoryChanges.goldSpent && (inventoryChanges.goldSpent.gp > 0 || inventoryChanges.goldSpent.sp > 0 || inventoryChanges.goldSpent.cp > 0) && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#f59e0b' }}>Spent: </span>
                  <span style={{ color: '#e0e0e0' }}>
                    {[
                      inventoryChanges.goldSpent.gp > 0 && `${inventoryChanges.goldSpent.gp} gp`,
                      inventoryChanges.goldSpent.sp > 0 && `${inventoryChanges.goldSpent.sp} sp`,
                      inventoryChanges.goldSpent.cp > 0 && `${inventoryChanges.goldSpent.cp} cp`
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {inventoryChanges.gained?.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>Gained: </span>
                  <span style={{ color: '#e0e0e0' }}>{inventoryChanges.gained.join(', ')}</span>
                </div>
              )}

              {inventoryApplied ? (
                <button
                  onClick={onUndoInventory}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '4px',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Undo Changes
                </button>
              ) : !preInventorySnapshot ? (
                <button
                  onClick={onApplyInventory}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Apply Changes
                </button>
              ) : null}
            </div>
          )}

          {/* Companion XP Note */}
          {sessionRewards?.xp > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              fontSize: '0.9rem'
            }}>
              <span style={{ color: '#a78bfa' }}>👥 Party XP:</span>
              <span style={{ color: '#e0e0e0', marginLeft: '0.5rem' }}>
                All class-based companions will also receive +{sessionRewards.xp} XP
              </span>
            </div>
          )}

          {/* NPCs Discovered Section */}
          {extractedNpcs && extractedNpcs.length > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(230, 126, 34, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(230, 126, 34, 0.3)'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#e67e22' }}>
                👤 NPCs Added to Database
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {extractedNpcs.map((npc, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem'
                  }}>
                    <span style={{ color: '#f39c12', fontWeight: 'bold' }}>{npc.name}</span>
                    {npc.race && <span style={{ color: '#888' }}>({npc.race})</span>}
                    {npc.occupation && <span style={{ color: '#aaa' }}>- {npc.occupation}</span>}
                  </div>
                ))}
              </div>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: '#888' }}>
                These NPCs are now available on the NPCs page where you can view and edit their details.
              </p>
            </div>
          )}

          {error && <div className="dm-error">{error}</div>}

          <button
            className="claim-rewards-btn"
            onClick={onClaimRewards}
            disabled={isLoading}
          >
            {isLoading ? 'Claiming...' : 'Claim Rewards'}
          </button>
        </div>
      </div>
  );
}

export default SessionRewards;
