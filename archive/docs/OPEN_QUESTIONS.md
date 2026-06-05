# Open Questions

Questions deferred for later investigation or work. Each has a short
answer / context so we can jump back in without re-discovering everything.

---

## Published Campaign Modules (asked 2026-04-21)

**Source:** [`client/src/data/campaignModules.js`](client/src/data/campaignModules.js)
(16 published + 1 custom). Module data flows into sessions via
[`server/routes/dmSession.js`](server/routes/dmSession.js) — the
`campaignModule` object is read from `sessionConfig` and spliced into the
opening prompt + system prompt.

### 1. How does the AI know what's in a module?

Each module in `campaignModules.js` is a plain object with:
- `name`, `description`, `synopsis` — identity + pitch
- `setting`, `year`, `themes[]`, `suggestedLevel`
- `keyLocations[]` — 4-7 named places
- `keyNpcs[]` — 5-8 named NPCs
- `plotPoints[]` — 6-8 major beats, ordered
- `dmGuidance` — one paragraph of tone + running notes

When you pick a module in Session Setup, that whole object gets stuffed
into the session config. The DM prompt builder surfaces it in the
opening prompt (`Begin the ${campaignModule.name} campaign...`) and the
AI treats the fields as canon. On continuations, the last session
summary does the heavy lifting and the module fields stay as reference.

**Practical takeaway:** the AI knows an *outline*, not the book. It's
working from the cheat sheet — locations, NPCs, plot points, vibe. It
will improvise everything else.

### 2. How complete are they?

Thin. Each module is 20-40 lines of structured summary — not the full
adventure. For reference:
- Curse of Strahd (the book) is ~258 pages. Our entry: 8 key locations,
  6 NPCs, 8 plot points, 1 paragraph of guidance.
- Descent into Avernus (the book) is ~256 pages. Our entry: 5 locations,
  6 NPCs, 8 plot points, 1 paragraph.

The AI will deliver *flavor-accurate* play — Strahd will toy with the
party, Barovia will feel gothic, the Tarokka reading will matter — but
it's improvising specific encounters, NPC dialogue, dungeon maps, and
combat stats on the fly. It doesn't have the actual written adventure
content because we never ingested it.

**If you wanted deeper fidelity for a specific module**, the path would
be: hand-write a `modules/<id>/chapters.md` file with the actual beats,
store it in the DB as a reference doc, and inject chapter-appropriate
chunks into the DM prompt as the party progresses. That's a significant
piece of work (~a week for one module done well) and would only pay off
for modules you actually care about.

### 3. How do we add new ones?

Append an object to the `CAMPAIGN_MODULES` array in
`client/src/data/campaignModules.js`. That's it — no server changes, no
migrations, no DB writes. The Session Setup dropdown auto-discovers.

**Template for Ravenloft: The Horrors Within** (or any new module):

```js
{
  id: 'ravenloft-horrors-within',
  name: 'Ravenloft: The Horrors Within',
  description: 'New gothic horror adventure across the Domains of Dread',
  type: 'published',
  icon: '🦇',
  suggestedLevel: '1-10', // adjust when released
  setting: 'Domains of Dread (Ravenloft)',
  year: 'Timeless (Ravenloft exists outside normal time)',
  themes: ['Gothic Horror', 'Dark Fantasy', 'Mystery'],
  synopsis: '…',
  keyLocations: ['…', '…'],
  keyNpcs: ['…', '…'],
  plotPoints: ['…', '…'],
  dmGuidance: '…'
}
```

Rough effort: 15-30 min once the book is out and you've skimmed the
table of contents + DM guidance section. No version bump needed — just
ship the file change.

### 4. Chronological play-through?

**Current state:** every module has a `year` field (e.g. `'1492 DR'`,
`'1486 DR'`, `'1285-1290 DR'`, `'Timeless'`). No explicit ordering
flag, no next/prev pointer, no "campaign chain" concept yet.

**Chronological ordering as-is** (by year, roughly):
1. `bloodstone-pass` — 1285-1290 DR (Witch-King / Orcus era)
2. `pool-of-radiance` — 1340 DR (Moonsea frontier era)
3. `against-the-giants` / `temple-elemental-evil` / `ruins-of-undermountain` — 1357 DR (pre-Time-of-Troubles)
4. `ghosts-of-saltmarsh` — 1480 DR (flexible)
5. `dead-in-thay` / `storm-kings-thunder` — 1486 DR
6. `rime-of-the-frostmaiden` / `tomb-of-annihilation` — 1489 DR
7. `waterdeep-dragon-heist` / `vecna-eve-of-ruin` — 1492 DR
8. `baldurs-gate-descent` — 1494 DR
9. `curse-of-strahd` — timeless
10. `tales-yawning-portal` — various (mixed eras)

**To actually build this as a feature**, the lightweight version would be:
- Add a `chronological_order: N` field to each module (explicit integer
  so "flexible" / "timeless" modules can be placed sensibly)
- Sort the module picker by this field when a "chronological" toggle is on
- Optionally: a "Campaign Chain" wizard that queues 2-3 modules to run
  in order, carrying the same character forward (would require handling
  level scaling — e.g. Bloodstone ends at 20, Pool of Radiance starts at 1)

**The level-scaling problem is the real blocker.** Most chronological
chains would require a character to reset to L1 between modules, which
breaks continuity. The in-universe workaround is "new party, same
world" — viable, but it's not really one character playing through
history, it's a campaign anthology.

**If you want this:** straightforward half-day of work for the order
field + sorted picker + optional chain UI. Deeper "level-scaled
connective tissue between modules" is more like a week.

---

## Parking Lot

New open questions go here as they come up.

