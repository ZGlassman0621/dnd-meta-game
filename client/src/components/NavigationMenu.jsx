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
 *     showDMMode           — DM Mode (tooling, not play)
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
  { key: 'showCharacterSheet', label: 'Character', color: '#3498db' },
  { key: 'showCompanions', label: 'Companions', color: '#3498db' },
  { key: 'showCampaigns', label: 'Campaign', color: '#9b59b6' },
  { key: 'showDMSession', label: 'Play', color: '#e67e22' }
]

export default function NavigationMenu({ activeView, onNavigate, hasCharacter, onHome }) {
  const isAnyViewActive = activeView !== null

  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center'
    }}>
      {isAnyViewActive && (
        <button
          onClick={onHome}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Home
        </button>
      )}

      {NAV_ITEMS.map(item => {
        const isActive = activeView === item.key
        // Everything in the spine acts on a selected character, so without one
        // the links are inert rather than hidden — the shape of the app stays
        // legible instead of rearranging itself.
        const disabled = !hasCharacter
        return (
          <button
            key={item.key}
            onClick={() => !disabled && onNavigate(item.key)}
            disabled={disabled}
            style={{
              background: isActive ? item.color : 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${isActive ? item.color : 'rgba(255, 255, 255, 0.2)'}`,
              color: isActive ? '#1a1a2e' : (disabled ? '#666' : '#fff'),
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              fontWeight: isActive ? 600 : 400,
              opacity: disabled ? 0.5 : 1
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
