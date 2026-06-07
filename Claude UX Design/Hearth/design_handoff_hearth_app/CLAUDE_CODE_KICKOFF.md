# Claude Code Kickoff — reskinning `dnd-meta-game` to the Hearth design system

> Repo: **ZGlassman0621/dnd-meta-game** · client = **React 18 + Vite**, styling = **plain global CSS** (`client/src/index.css` + `client/src/styles/creator-theme.css`, imported in `client/src/main.jsx`). No CSS framework, no token variables today — the palette (`#1a1a2e`/`#16213e` bg, `#f39c12` orange) is hardcoded throughout.

## What this is
The Hearth HTML files in this folder are a **visual + UX redesign of an app that already exists and works.** The functional logic — character creation, DM sessions, the character sheet, downtime, campaign setup, content preferences — is already built in React components. **Do not rebuild the logic. Reskin it** to the Hearth "dark-editorial" system (warm near-black surfaces, parchment ink, one manuscript-gold accent, EB Garamond voice). The only place that is a genuine *behavior* change, not just a restyle, is **Begin a Campaign** (see below).

Read `README.md` in this folder first for the full token + component spec. This file maps it onto the real codebase.

## Strategy — two phases

### Phase A — palette + type swap (fast, ~80% of the visual shift)
The app hardcodes the same ~12 hex values everywhere. Introduce the Hearth tokens once and remap:

1. Add **`client/src/styles/hearth-theme.css`** = the `:root{…}` token block from this folder's `tokens.css` (surfaces, ink, rules, accents, semantic, type families, shadows, radii). Import it **first** in `main.jsx` (before `index.css`) so variables are defined.
2. Replace the hardcoded palette across `index.css` + `creator-theme.css` with the tokens below (a find-and-replace pass). This alone reskins the whole app to Hearth's warmth.
3. Load the fonts and set the type rule (serif for prose/headings, sans for UI chrome, mono for numbers).

**Color remap (existing → Hearth token):**
| existing hex | role | → Hearth token |
|---|---|---|
| `#1a1a2e` | app bg | `--bg` (`#1a1712`) |
| `#16213e` / `linear-gradient(135deg,#1a1a2e,#16213e)` | raised/gradient bg | `--bg-2` (`#221e18`); drop the blue gradient for `body.app-bg`'s candlelit radials |
| `rgba(255,255,255,.05–.08)` | card surfaces | `--bg-card` / `--bg-2` |
| `#f39c12` (+ `#e67e22`, `#f1c40f`) | primary orange accent | `--accent` (`#c9a96a` gold); pressed → `--accent-d` |
| `#3498db` | secondary blue / info / links | `--accent-2` (`#8ba2c6`) |
| `#e74c3c` | danger/damage | `--bad` (`#cf8478`) |
| `#2ecc71` / `#27ae60` | success/heal/HP | `--good` (`#93b98a`) |
| `#9b59b6` | magic/downtime purple | `--magic` (`#ab9fda`) |
| `#e4e4e4` / `#fff` | primary text | `--ink` (`#ece4d6`) |
| `#bbb` / `#888` | secondary / muted text | `--ink-2` / `--ink-3` |
| `rgba(255,255,255,.1–.2)` | borders | `--rule` / `--rule-soft` |

**Fonts** — load EB Garamond + Inter + JetBrains Mono (URL in README). Replace the `-apple-system…` body stack: set **Inter** as the UI default, apply **EB Garamond** to headings/prose/narrative (`h1–h3`, `.narrative`, `.dm-message`, `.backstory-content`, `.feature-description`, card titles), and **JetBrains Mono** to numbers/labels/timestamps (`.stat-value`, `.vital-value`, `.currency-amount`, ability scores, meta lines).

### Phase B — component fidelity (screen by screen)
After the palette/type swap, bring each screen up to pixel fidelity against its Hearth reference, mapping existing CSS classes to Hearth's component vocabulary (`.btn/.chip/.tagpill/.panel/.card/.narr-card/.scrim/.modal/.dash-hdr/.crest`). Suggested class moves:
- `.button` → Hearth `.btn.primary`; `.button-secondary` → `.btn`; `.button-danger` → `.btn.danger`. Buttons become uppercase Inter, `.14em` tracking, gold primary.
- `.character-card` / `.adventure-option` / `.campaign-module-card` / `.npc-card` → Hearth `.nav-card` / `.card` hover pattern (lift `-2px`, warm border to gold).
- `.modal-overlay` / `.modal-content` → Hearth `.scrim` + `.modal`.
- `.narrative` / `.dm-message.narrative|action|summary` → Hearth `.narr-card` (3px accent bar; recolor bar with `--accent-2` / `--combat` / `--good`).
- `.progress-bar`/`.progress-fill`, `.xp-bar`, `.vital-bar` → Hearth `.hpbar`/`.hptrack` + pips.
- `.sheet-tabs`/`.tab-button` → Hearth sheet-tab treatment (serif, gold active underline).
- `.risk-badge`, `.relationship-badge`, `.campaign-badge` → Hearth `.chip` semantic variants.

## Screen → component map
| Hearth reference | Existing component(s) to reskin | Notes |
|---|---|---|
| `Dashboard.html` **+ first-time tutorial** | `MetaGameDashboard.jsx` | Reskin to the hero + nav-grid. **Add the new welcome-card→spotlight tour** (localStorage-gated, "Replay tour" in header, first-time hero swap) — see README §1. New behavior. |
| `Begin Campaign.html` | `CampaignPrepScreen.jsx` (+ `CampaignsPage.jsx` entry button) | **Genuine UX change.** Today this is a form (module grid, length radios, content toggles). The redesign turns it into a **conversational atelier**: Opus drafts a premise from a prompt/seed; dials on the side. The existing inputs survive as the side dials — `.campaign-length-options` → Scope segmented (**relabel "Open-ended" → "Ongoing campaign"**), `.content-preferences-grid` → **Content boundaries** modal (Open/Veil/Line), module/setting → Setting dial. The conversation + premise/opening-scene preview + cinematic Begin are new. |
| `Campaigns.html` | `CampaignsPage.jsx` | Active-campaign feature card + seeds. "Begin a new campaign" → opens the atelier greeting; backstory seed → atelier pre-filled. |
| `Character Sheet.html` | `CharacterSheet.jsx` | Reskin tabs (`.sheet-tabs`) + sections; keep all logic. |
| `Companions.html` | `CompanionsPage.jsx` (+ `CompanionManager/Sheet/Editor`) | Companion roster reskin. |
| `Campaign Plan.html` | `CampaignPlanPage.jsx` | Keep the spoiler **veil** (blur→reveal). |
| `Backstory.html` | `BackstoryParserPage.jsx` | Parsed people/places/hooks. |
| `Settings.html` | `CharacterSettings.jsx`, `GenerationControlsPage.jsx` | Difficulty/tone/DM behavior dials. |
| `Level Up.html` | `LevelUpPage.jsx` | Uses `_lu3.png`. |
| `Create Character.html` | `CharacterCreationWizard.jsx` | Step ribbon + sticky footer + Review. |
| `Cockpit - Calm/Combat.html` | `DMSession.jsx`, `DMMode.jsx` (+ `CombatTracker`, `DiceRoller`, `InitiativeTracker`, panels) | The 90% screen; reskin DM prose column + right rail. |
| `Roster.html` / `Roster - Empty.html` | `CharacterManager.jsx` | Character picker + empty state. |

## Notes that prevent rework
- **Content preferences already exist** (`.content-preferences-grid` / `.content-toggle`, checkbox per topic). The Hearth design upgrades these from on/off checkboxes to a three-state **Open / Veil / Line** control in a modal — preserve the underlying preference data; widen the schema from boolean to enum.
- **Campaign length already exists** — just relabel and restyle into the segmented control; "Open-ended" becomes "Ongoing campaign".
- **The dashboard tutorial is net-new UI.** Build it as a small React component over `MetaGameDashboard` (state machine: `welcome | step 0..n | end`, persisted to `localStorage`). The README's §1 includes the spotlight-transition gotcha — read it.
- Keep `creator-theme.css` and `index.css` working during the migration; introduce `hearth-theme.css` and migrate incrementally so the app never breaks between commits.

---

## Paste this into Claude Code (run from the repo root)
```
We're reskinning this app to the "Hearth" design system. The spec + HTML
references are in design_handoff_hearth_app/ — read README.md and
CLAUDE_CODE_KICKOFF.md in that folder first. This is a RESKIN: do not rebuild
component logic, restyle it.

Phase A (do this first, one PR):
1. Create client/src/styles/hearth-theme.css from the :root token block in
   design_handoff_hearth_app/tokens.css. Import it in client/src/main.jsx
   BEFORE index.css.
2. Do a palette find-and-replace across index.css + styles/creator-theme.css
   using the color-remap table in CLAUDE_CODE_KICKOFF.md (orange #f39c12 →
   gold --accent, blue bg → warm --bg/--bg-2, etc.).
3. Load EB Garamond / Inter / JetBrains Mono and apply the type rule
   (serif = prose/headings, sans = UI, mono = numbers).
Verify the app still runs (npm run install-all && npm run dev) and screenshots
read as warm dark-editorial, not blue/orange.

Phase B (subsequent PRs, one screen at a time): bring each screen to pixel
fidelity against its Hearth .html reference using the screen→component map.
Start with MetaGameDashboard.jsx (incl. the new first-time tutorial) and the
Begin-a-Campaign atelier (redesign of CampaignPrepScreen.jsx). Open each .html
file in a browser as the live reference. Flag the content-preferences →
Open/Veil/Line schema change before implementing.
```
