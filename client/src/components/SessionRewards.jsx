import React from 'react';
import { HearthSprite, Ic } from './hearthUI.jsx';
import '../styles/hearth.css';
import '../styles/hearth-rewards.css';

/* ─────────────────────── Hearth · End-of-session Rewards ───────────────────────
   The screen shown after a session completes. Pure presentation — all of the
   reward data, the claim handler, and the inventory apply/undo handlers come in
   as props from DMSession.jsx. XP is the single headline (the only gold accent);
   gold / health / loot and the supporting blocks read in muted parchment ink.
   Styles live in styles/hearth-rewards.css (all selectors scoped under .hearth).
   ───────────────────────────────────────────────────────────────────────────── */

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
  sessionAchievements = [],
  onClaimRewards,
  onApplyInventory,
  onUndoInventory,
  isLoading,
  character,
  messages,
  error
}) {
  const breakdown = sessionRewards?.breakdown;
  const cats = breakdown?.categories;
  const goldSpent = inventoryChanges?.goldSpent;
  const hasGoldSpent = goldSpent && (goldSpent.gp > 0 || goldSpent.sp > 0 || goldSpent.cp > 0);
  const hasInventoryChanges = inventoryChanges && (
    inventoryChanges.consumed?.length > 0 ||
    inventoryChanges.gained?.length > 0 ||
    hasGoldSpent
  );

  return (
    <div className="hearth rewards app-bg">
      <HearthSprite />

      {/* ───────── HEADER ───────── */}
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <span className="hdr-link" style={{ cursor: 'default' }}>{character?.name}</span>
        <div className="spacer"></div>
        <span className="opus"><span className="dot"></span>Opus</span>
      </header>

      <main className="rw-wrap">
        {/* ───────── TITLE ───────── */}
        <div className="rw-title">
          <span className="eyebrow">Session complete</span>
          <h1>Adventure Complete</h1>
        </div>

        {/* ───────── RECAP (last beats) ───────── */}
        <div className="rw-recap">
          {messages.slice(-3).map((msg, idx) => (
            <div
              key={idx}
              className={`narr-card${msg.type === 'action' ? ' rc-you' : ''}`}
            >
              <div className="marker">
                {msg.type === 'action'
                  ? character.name
                  : msg.type === 'summary'
                    ? 'Adventure summary'
                    : 'The table'}
              </div>
              <div className="ncbody">{msg.content}</div>
            </div>
          ))}
        </div>

        {/* ───────── REWARDS ───────── */}
        <div className="rw-sec"><h2>Session rewards</h2><span className="fl"></span></div>

        {/* Headline — XP (the one gold accent) */}
        <div className="rw-headline">
          <Ic n="sparkles" className="ic hl-ic" />
          <div className="hl-txt">
            <span className="hl-l">Experience earned</span>
            <span className="hl-v">+{sessionRewards?.xp || 0}<span className="un">XP</span></span>
          </div>
        </div>

        {/* Secondary reward tiles */}
        <div className="rw-tiles">
          <div className="rw-tile">
            <div className="t-l">Gold</div>
            <div className="t-v">{formatGold(sessionRewards?.gold)}</div>
          </div>

          <div className="rw-tile">
            <div className="t-l">Health</div>
            <div className={`t-v ${hpChange >= 0 ? 'heal' : 'damage'}`}>
              {hpChange >= 0 ? '+' : ''}{hpChange} HP
            </div>
          </div>

          {sessionRewards?.loot && (
            <div className="rw-tile loot span">
              <div className="t-l">Loot found</div>
              <div className="t-v">{sessionRewards.loot}</div>
            </div>
          )}
        </div>

        {/* XP Breakdown */}
        {cats && (
          <div className="rw-block">
            <h4 className="bh"><Ic n="bolt" className="ic" />XP breakdown</h4>
            <div className="rw-xpgrid">
              {cats.combat.xp > 0 && (
                <div className="rw-xprow"><span className="xk">Combat</span><span className="xv">+{cats.combat.xp} XP</span></div>
              )}
              {cats.exploration.xp > 0 && (
                <div className="rw-xprow"><span className="xk">Exploration</span><span className="xv">+{cats.exploration.xp} XP</span></div>
              )}
              {cats.quests.xp > 0 && (
                <div className="rw-xprow"><span className="xk">Quests</span><span className="xv">+{cats.quests.xp} XP</span></div>
              )}
              {cats.discovery.xp > 0 && (
                <div className="rw-xprow"><span className="xk">Discovery</span><span className="xv">+{cats.discovery.xp} XP</span></div>
              )}
              {cats.social.xp > 0 && (
                <div className="rw-xprow"><span className="xk">Social</span><span className="xv">+{cats.social.xp} XP</span></div>
              )}
              {breakdown.dangerBonus?.xp > 0 && (
                <div className="rw-xprow span"><span className="xk">Danger bonus</span><span className="xv">+{breakdown.dangerBonus.xp} XP</span></div>
              )}
            </div>
          </div>
        )}

        {/* Inventory Changes */}
        {hasInventoryChanges && (
          <div className="rw-block">
            <h4 className="bh">
              <Ic n="pack" className="ic" />Inventory changes
              {inventoryApplied && <span className="flag ok">Auto-applied</span>}
              {!inventoryApplied && !preInventorySnapshot && <span className="flag undone">Undone</span>}
            </h4>

            {inventoryChanges.consumed?.length > 0 && (
              <div className="rw-change"><span className="ck used">Used</span><span className="cv">{inventoryChanges.consumed.join(', ')}</span></div>
            )}

            {hasGoldSpent && (
              <div className="rw-change">
                <span className="ck spent">Spent</span>
                <span className="cv">
                  {[
                    goldSpent.gp > 0 && `${goldSpent.gp} gp`,
                    goldSpent.sp > 0 && `${goldSpent.sp} sp`,
                    goldSpent.cp > 0 && `${goldSpent.cp} cp`
                  ].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            {inventoryChanges.gained?.length > 0 && (
              <div className="rw-change"><span className="ck gained">Gained</span><span className="cv">{inventoryChanges.gained.join(', ')}</span></div>
            )}

            {inventoryApplied ? (
              <div className="rw-block-actions">
                <button className="btn danger sm" onClick={onUndoInventory}>Undo changes</button>
              </div>
            ) : !preInventorySnapshot ? (
              <div className="rw-block-actions">
                <button className="btn primary sm" onClick={onApplyInventory}>Apply changes</button>
              </div>
            ) : null}
          </div>
        )}

        {/* Companion / party XP note */}
        {sessionRewards?.xp > 0 && (
          <div className="rw-block">
            <p className="rw-note">
              <span className="nk">Party XP — </span>
              All class-based companions will also receive +{sessionRewards.xp} XP.
            </p>
          </div>
        )}

        {/* NPCs discovered */}
        {extractedNpcs && extractedNpcs.length > 0 && (
          <div className="rw-block">
            <h4 className="bh"><Ic n="users" className="ic" />NPCs added to database</h4>
            <div className="rw-npcs">
              {extractedNpcs.map((npc, idx) => (
                <div key={idx} className="rw-npc">
                  <span className="nn">{npc.name}</span>
                  {npc.race && <span className="nr">{npc.race}</span>}
                  {npc.occupation && <span className="no">{npc.occupation}</span>}
                </div>
              ))}
            </div>
            <p className="rw-npcs-foot">
              These NPCs are now available on the NPCs page where you can view and edit their details.
            </p>
          </div>
        )}

        {/* Achievements */}
        {sessionAchievements.length > 0 && (
          <>
            <div className="rw-sec"><h2>Achievements unlocked</h2><span className="fl"></span></div>
            <div className="rw-achs">
              {sessionAchievements.map((ach, idx) => (
                <div key={idx} className="rw-ach">
                  <span className="ai">{ach.icon || '🏆'}</span>
                  <div>
                    <div className="at">{ach.title}</div>
                    <div className="ad">{ach.description}</div>
                    {ach.rewards && (
                      <div className="ar">
                        {[
                          ach.rewards.xp && `+${ach.rewards.xp} XP`,
                          ach.rewards.gold && `+${ach.rewards.gold} gp`,
                          ...(ach.rewards.items || [])
                        ].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {error && <div className="rw-error">{error}</div>}

        {/* ───────── CLAIM ───────── */}
        <div className="rw-foot">
          <button
            className="btn primary lg"
            onClick={onClaimRewards}
            disabled={isLoading}
          >
            {isLoading ? 'Claiming…' : 'Claim rewards'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default SessionRewards;
