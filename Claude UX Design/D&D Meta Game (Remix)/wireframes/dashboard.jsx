// Dashboard / home / campaign picker — 3 variations

const DashV1_Cards = () => (
  <Artboard title="V1 — Campaign Card Grid" label="conventional · tab nav">
    <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
      <Box cls="hollow" style={{ padding: "8px 12px", flex: 1 }}>
        <div className="w-mono">welcome back, traveler</div>
        <div className="w-title" style={{ margin: 0 }}>Pick up where you left off?</div>
      </Box>
      <Btn primary>+ New Campaign</Btn>
      <Btn ghost>Import JSON</Btn>
    </div>
    <div className="ui-tabs">
      <div className="t active">Player Mode</div>
      <div className="t">DM Mode</div>
      <div className="t">Prelude</div>
      <div className="t">Archived</div>
    </div>
    <div className="grid-3">
      {[
        { t: "The Crowned Shadow", lvl: "Lvl 7 · Session 14", tag: "active" },
        { t: "Order of Dawn", lvl: "Lvl 3 · Session 5", tag: "active" },
        { t: "Ashes of Neverwinter", lvl: "Lvl 12 · Session 28", tag: "paused" }
      ].map((c, i) => (
        <div key={i} className="card">
          <Img label="banner" style={{ height: 70, marginBottom: 8 }} />
          <div className="w-title" style={{ margin: 0 }}>{c.t}</div>
          <div className="w-sub">{c.lvl}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <Chip accent={c.tag === "active"} warn={c.tag === "paused"}>{c.tag}</Chip>
            <Chip>3 companions</Chip>
          </div>
        </div>
      ))}
    </div>
    <Hr />
    <div className="w-title" style={{ fontSize: 16 }}>Recent activity</div>
    <div className="w-col" style={{ marginTop: 6 }}>
      {["Kaelen gained level 7 — choose theme tier", "Mirabel sent mail · Greypeak Hold", "Weather shifted → Hard Frost in Thornveil"].map((x, i) => (
        <Box key={i} cls="dashed" style={{ padding: 8 }}>
          <div className="w-sub" style={{ fontSize: 13 }}>{x}</div>
        </Box>
      ))}
    </div>
    <Annot style={{ top: 16, right: 200 }}>keep primary action always visible</Annot>
  </Artboard>
);

const DashV2_Sidebar = () => (
  <Artboard title="V2 — Sidebar + World Pulse" label="sidebar nav · world-state forward">
    <div style={{ display: "flex", gap: 14, height: "100%" }}>
      <div className="ui-sidebar">
        <div className="w-mono" style={{ padding: "4px 10px" }}>CAMPAIGNS</div>
        <div className="item active">Crowned Shadow</div>
        <div className="item">Order of Dawn</div>
        <div className="item">Ashes of N…</div>
        <Hr />
        <div className="w-mono" style={{ padding: "4px 10px" }}>QUICK NAV</div>
        <div className="item">Character Sheet</div>
        <div className="item">Party Base</div>
        <div className="item">NPC Codex</div>
        <div className="item">Living World</div>
        <div className="item">Companions</div>
        <Hr />
        <Btn primary style={{ fontSize: 12, padding: "5px 10px" }}>▶ Continue Session</Btn>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <Box cls="accent">
          <div className="w-mono" style={{ color: "var(--accent)" }}>NEXT UP</div>
          <div className="w-title" style={{ margin: "2px 0" }}>Session 15 — “The Hollow Pact”</div>
          <div className="w-sub">Party is at Thornveil Gate · 2 narrative nudges waiting</div>
        </Box>
        <div className="grid-2">
          <Box title="World Pulse" sub="since last session">
            <div className="w-col" style={{ gap: 6, marginTop: 4 }}>
              <div className="w-row"><Chip ok>+</Chip><span className="w-sub">Faction: Guild of Iron gained ground</span></div>
              <div className="w-row"><Chip warn>⚠</Chip><span className="w-sub">NPC Mirabel missing 12 days</span></div>
              <div className="w-row"><Chip>☁</Chip><span className="w-sub">Weather: snow in Thornveil</span></div>
              <div className="w-row"><Chip accent>⚔</Chip><span className="w-sub">Base threat approaching — Greypeak Hold</span></div>
            </div>
          </Box>
          <Box title="Party" sub="Kaelen + 2 companions">
            <div className="w-row" style={{ gap: 10, marginTop: 4 }}>
              <Portrait size={44} />
              <Portrait size={44} />
              <Portrait size={44} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Chip>HP 42/52</Chip>
              <Chip accent>XP 78%</Chip>
              <Chip>Gold 1,284</Chip>
              <Chip warn>Level-up pending</Chip>
            </div>
          </Box>
        </div>
        <Box title="Plot threads" sub="3 active">
          <Ph w="full" /><Ph w="med" /><Ph w="full" />
        </Box>
      </div>
    </div>
  </Artboard>
);

const DashV3_Command = () => (
  <Artboard title="V3 — Command-first home" label="novel · palette-driven">
    <div style={{ textAlign: "center", padding: "18px 0 14px" }}>
      <div className="w-mono" style={{ color: "var(--ink-dim)" }}>THE CROWNED SHADOW · SESSION 15 READY</div>
      <div className="w-title" style={{ fontSize: 32, margin: "6px 0" }}>What do you want to do?</div>
    </div>
    <Box cls="panel" style={{ padding: 4 }}>
      <div className="w-row" style={{ padding: "8px 12px", borderBottom: "1px dashed var(--stroke-faint)" }}>
        <span className="w-mono">⌘K</span>
        <span className="w-sub" style={{ flex: 1, marginLeft: 10, fontFamily: "var(--hand)", fontSize: 16 }}>continue session…</span>
        <Chip>↵</Chip>
      </div>
      {[
        { kbd: "▶", t: "Continue Session 15 — Thornveil Gate", sub: "last: 2 days ago", tag: "session" },
        { kbd: "☰", t: "Open Character Sheet — Kaelen", sub: "lvl 7 · pending level-up", tag: "sheet" },
        { kbd: "🏰", t: "Greypeak Hold — manage base", sub: "⚠ raid approaching", tag: "base" },
        { kbd: "✎", t: "DM Mode: Ashes of Neverwinter", sub: "party of 4 · session 28", tag: "dm-mode" },
        { kbd: "✦", t: "Roll new campaign…", sub: "from backstory or module", tag: "new" }
      ].map((r, i) => (
        <div key={i} className="w-row" style={{ padding: "10px 12px", borderBottom: i < 4 ? "1px dashed var(--stroke-faint)" : "none" }}>
          <span className="w-mono" style={{ width: 22 }}>{r.kbd}</span>
          <div style={{ flex: 1, marginLeft: 6 }}>
            <div className="w-sub" style={{ fontSize: 14, color: "var(--ink)" }}>{r.t}</div>
            <div className="w-mono">{r.sub}</div>
          </div>
          <Chip>{r.tag}</Chip>
        </div>
      ))}
    </Box>
    <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
      <Chip>recent · Mirabel</Chip>
      <Chip>recent · Thornveil map</Chip>
      <Chip>recent · Iron Guild</Chip>
      <Chip accent>⌘N new</Chip>
    </div>
    <Annot style={{ top: 30, right: 12 }}>power-user home. one field, one key, everywhere.</Annot>
  </Artboard>
);

const Dashboard = () => (
  <Section id="dashboard" title="Dashboard" sub="home / campaign picker / pick-up-where-you-left-off">
    <DashV1_Cards />
    <DashV2_Sidebar />
    <DashV3_Command />
  </Section>
);

Object.assign(window, { Dashboard });
