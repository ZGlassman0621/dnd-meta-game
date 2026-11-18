/**
 * Primary navigation.
 *
 * MVP spine (v1.0.175): four destinations, flat. Three dropdown menus over ten
 * entries was the right shape when the app was a meta-game console with a
 * session attached; it is the wrong shape for "make a character, build a
 * campaign, play". Four links do not need to be filed under categories, and a
 * dropdown you must open to discover a single item is pure friction.
 *
 * Character *select* is not here — it is the root surface (HomeFlow), reached
 * by the "← Your characters" button in the app header.
 *
 * ── Hidden from nav, code intact ─────────────────────────────────────────
 * Every view below still routes in App.jsx and still works; it just has no
 * menu entry. Restoring one means adding a line to NAV_ITEMS, nothing more.
 * Per the standing convention in this project: hide surfaces, keep the code.
 *
 *   Cut in the MVP pass (v1.0.175):
 *     showParsedBackstory  — Backstory Parser
 *     showDowntime         — Downtime & Stats
 *     showSettings         — per-character settings page. NOTE: the appbar
 *                            "Settings" link opens SettingsOverlay, which is a
 *                            different surface and is still available.
 *     showCampaignPlan     — Campaign Plan viewer (generated during campaign
 *                            creation; the plan is used, just not browsable)
 *     showPlayerJournal    — Player Journal
 *
 *   Cut earlier:
 *     showLocations, showFactions, showTravel, showWorldEvents, showLivingWorld,
 *     showNPCGenerator, showNPCRelationships, showNarrativeQueue, showQuests,
 *     showBackstories, showMetaGame (embedded as a DM Session tab),
 *     showGeneration (runs automatically via the campaign plan)
 *
 * `showAIBehavior` is deliberately not a nav item either — it is a diagnostic
 * surface reached from the appbar.
 */

const NAV_ITEMS = [
  { key: 'showCharacterSheet', label: 'Character' },
  { key: 'showCompanions', label: 'Companions' },
  { key: 'showCampaigns', label: 'Campaign' },
  { key: 'showDMSession', label: 'Play' }
]

/**
 * v1.0.177 — converted to the paper shell. The per-item accent colours are
 * gone: they were category tints from the dropdown era, and with four flat
 * links the active state carries the meaning on its own. Styling lives in
 * `styles/shell.css` under `.shell-nav`, reading design tokens.
 *
 * The nav also stopped being absolutely positioned in the top-right corner.
 * It now sits in the header's flow, which is what lets the paper band size
 * itself to its contents instead of overlapping them.
 */
// S1 campaign gate (2026-11-17): Play needs a campaign. Shown to the player
// in plain words wherever Play appears; the server refuses too.
export const PLAY_LOCKED_REASON = 'Create or join a campaign to play'

export default function NavigationMenu({ activeView, onNavigate, hasCharacter, onHome, playLocked = false }) {
  const isAnyViewActive = activeView !== null

  return (
    <nav className="shell-nav">
      {isAnyViewActive && (
        <button type="button" onClick={onHome}>Home</button>
      )}

      {NAV_ITEMS.map(item => {
        // Everything in the spine acts on a selected character, so without one
        // the links are inert rather than hidden — the shape of the app stays
        // legible instead of rearranging itself.
        // S1: a character with no campaign sees Play, closed, with the reason
        // beside it — visible-but-disabled, never hidden. The reason is itself
        // the way in: it opens the existing Campaign (New Campaign / attach) page.
        const lockedPlay = item.key === 'showDMSession' && hasCharacter && playLocked
        const disabled = !hasCharacter || lockedPlay
        return (
          <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className={activeView === item.key ? 'is-active' : undefined}
              onClick={() => !disabled && onNavigate(item.key)}
              disabled={disabled}
              title={lockedPlay ? PLAY_LOCKED_REASON : undefined}
              data-play-locked={lockedPlay ? 'true' : undefined}
            >
              {item.label}
            </button>
            {lockedPlay && (
              <button
                type="button"
                onClick={() => onNavigate('showCampaigns')}
                style={{ fontSize: '0.8em', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', opacity: 0.85 }}
              >
                {PLAY_LOCKED_REASON}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
