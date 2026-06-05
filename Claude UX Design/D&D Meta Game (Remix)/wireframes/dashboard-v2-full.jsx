// Dashboard V2 — Full-screen exploration
// Sidebar navigation + World Pulse forward
// Fills the entire viewport, not just an artboard

const DashV2Full = () => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "240px 1fr 320px",
    gap: 0,
    height: "calc(100vh - 180px)",
    minHeight: 720,
    border: "1.5px solid var(--stroke-faint)",
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--bg-2)"
  }}>
    {/* LEFT SIDEBAR */}
    <div style={{
      background: "color-mix(in oklab, var(--panel) 70%, transparent)",
      borderRight: "1px dashed var(--stroke-faint)",
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      overflowY: "auto"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg)", fontFamily: "var(--hand)", fontSize: 18, fontWeight: 700 }}>D</div>
        <div>
          <div className="w-title" style={{ margin: 0, fontSize: 15 }}>D&D Meta</div>
          <div className="w-mono">kaelen · lvl 7</div>
        </div>
      </div>

      <div className="w-mono" style={{ marginTop: 6 }}>CAMPAIGNS</div>
      <div className="ui-sidebar" style={{ width: "auto" }}>
        <div className="item active">▸ Crowned Shadow</div>
        <div className="item">Order of Dawn</div>
        <div className="item">Ashes of Neverwinter</div>
        <div className="item" style={{ color: "var(--ink-faint)" }}>+ new campaign</div>
      </div>

      <Hr />

      <div className="w-mono">PLAY</div>
      <div className="ui-sidebar" style={{ width: "auto" }}>
        <div className="item">▶ Continue Session</div>
        <div className="item">⏸ Prelude Arc</div>
        <div className="item">✎ DM Mode</div>
      </div>

      <Hr />

      <div className="w-mono">CHARACTER</div>
      <div className="ui-sidebar" style={{ width: "auto" }}>
        <div className="item">☰ Sheet</div>
        <div className="item">⚡ Progression</div>
        <div className="item">✦ Mythic</div>
        <div className="item">👥 Companions</div>
      </div>

      <Hr />

      <div className="w-mono">WORLD</div>
      <div className="ui-sidebar" style={{ width: "auto" }}>
        <div className="item">🗺 Living World</div>
        <div className="item">📖 NPC Codex</div>
        <div className="item">⚔ Quests</div>
        <div className="item">🏰 Greypeak Hold</div>
        <div className="item">💰 Merchants</div>
      </div>

      <div style={{ flex: 1 }}></div>

      <Box cls="dashed" style={{ padding: 8 }}>
        <div className="w-mono" style={{ color: "var(--ok)" }}>● LLM · Sonnet 4.6</div>
        <div className="w-mono">session tokens: 42k</div>
      </Box>
    </div>

    {/* CENTER — MAIN COLUMN */}
    <div style={{ padding: 22, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero continue card */}
      <Box cls="accent" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="w-mono" style={{ color: "var(--accent)", marginBottom: 4 }}>NEXT UP · SESSION 15</div>
            <div className="w-title" style={{ fontSize: 26, margin: "2px 0 6px" }}>"The Hollow Pact"</div>
            <div className="w-sub" style={{ fontSize: 14, color: "var(--ink-dim)" }}>
              Last: the party heard voices in the Thornveil gatehouse. 2 narrative nudges waiting.
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Chip>Thornveil Gate · dusk</Chip>
              <Chip>HP 42/52</Chip>
              <Chip accent>Session 14 · 2 days ago</Chip>
              <Chip warn>1 chapter-end looming</Chip>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <Btn primary style={{ fontSize: 16, padding: "10px 20px" }}>▶ Continue session</Btn>
            <Btn ghost>view chronicle</Btn>
          </div>
        </div>
      </Box>

      {/* Party row */}
      <div>
        <div className="w-row" style={{ marginBottom: 8, alignItems: "baseline" }}>
          <div className="w-title" style={{ fontSize: 18, margin: 0 }}>Party</div>
          <div className="w-mono" style={{ marginLeft: 8 }}>3 members · 1 away</div>
          <div style={{ flex: 1 }}></div>
          <Btn ghost>manage →</Btn>
        </div>
        <div className="grid-3">
          {[
            { n: "Kaelen Voss", r: "Warlock 7 · Tiefling", hp: "42/52", tag: "you", c: "accent" },
            { n: "Mira Halsen", r: "Ranger 6 · Half-elf", hp: "38/44", tag: "companion", c: "" },
            { n: "Dorne Ironshield", r: "Fighter 7 · Dwarf", hp: "—", tag: "away · scouting", c: "warn" },
          ].map((p, i) => (
            <Box key={i} cls={p.c === "accent" ? "accent" : p.c === "warn" ? "dashed" : ""}>
              <div style={{ display: "flex", gap: 10 }}>
                <Portrait size={52} />
                <div style={{ flex: 1 }}>
                  <div className="w-title" style={{ fontSize: 14, margin: 0 }}>{p.n}</div>
                  <div className="w-mono">{p.r}</div>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <Chip accent={p.c === "accent"} warn={p.c === "warn"}>{p.tag}</Chip>
                    <Chip>HP {p.hp}</Chip>
                  </div>
                </div>
              </div>
            </Box>
          ))}
        </div>
      </div>

      {/* World Pulse + quick stats */}
      <div>
        <div className="w-row" style={{ marginBottom: 8, alignItems: "baseline" }}>
          <div className="w-title" style={{ fontSize: 18, margin: 0 }}>World Pulse</div>
          <div className="w-mono" style={{ marginLeft: 8 }}>since session 14</div>
          <div style={{ flex: 1 }}></div>
          <Btn ghost>full living world →</Btn>
        </div>
        <div className="grid-2">
          <Box title="Factions" sub="3 active">
            <div className="w-col" style={{ gap: 6, marginTop: 4 }}>
              <div className="w-row" style={{ gap: 8 }}>
                <Chip ok>+12%</Chip>
                <span className="w-sub" style={{ flex: 1 }}>Guild of Iron gained ground in Thornveil</span>
              </div>
              <div className="w-row" style={{ gap: 8 }}>
                <Chip warn>−8%</Chip>
                <span className="w-sub" style={{ flex: 1 }}>House Varran lost a council seat</span>
              </div>
              <div className="w-row" style={{ gap: 8 }}>
                <Chip>=</Chip>
                <span className="w-sub" style={{ flex: 1 }}>The Ashen Choir · watching, unchanged</span>
              </div>
            </div>
          </Box>
          <Box title="Events & weather">
            <div className="w-col" style={{ gap: 6, marginTop: 4 }}>
              <div className="w-row" style={{ gap: 8 }}>
                <Chip>☁</Chip>
                <span className="w-sub" style={{ flex: 1 }}>Hard frost in Thornveil · exposure risk</span>
              </div>
              <div className="w-row" style={{ gap: 8 }}>
                <Chip accent>✉</Chip>
                <span className="w-sub" style={{ flex: 1 }}>Letter from Mirabel · 2 days ago</span>
              </div>
              <div className="w-row" style={{ gap: 8 }}>
                <Chip warn>⚔</Chip>
                <span className="w-sub" style={{ flex: 1 }}>Greypeak Hold · raid in 4 days</span>
              </div>
            </div>
          </Box>
        </div>
      </div>

      {/* Plot threads */}
      <div>
        <div className="w-row" style={{ marginBottom: 8, alignItems: "baseline" }}>
          <div className="w-title" style={{ fontSize: 18, margin: 0 }}>Plot threads</div>
          <div className="w-mono" style={{ marginLeft: 8 }}>3 active · 1 stalling</div>
          <div style={{ flex: 1 }}></div>
        </div>
        <div className="w-col" style={{ gap: 8 }}>
          {[
            { t: "Find out what happened to Mirabel Kain", s: "last seen 12 days ago at the Crooked Oak", tag: "main", c: "accent" },
            { t: "The Hollow Pact — who opened the gate?", s: "heard arguing voices · unresolved", tag: "active", c: "" },
            { t: "Restore House Voss to council", s: "stalling · no movement in 3 sessions", tag: "stalling", c: "warn" },
          ].map((p, i) => (
            <Box key={i} cls={p.c === "accent" ? "accent" : p.c === "warn" ? "warn" : "dashed"}>
              <div className="w-row">
                <div style={{ flex: 1 }}>
                  <div className="w-sub" style={{ fontSize: 14, color: "var(--ink)" }}>{p.t}</div>
                  <div className="w-mono">{p.s}</div>
                </div>
                <Chip accent={p.c === "accent"} warn={p.c === "warn"}>{p.tag}</Chip>
              </div>
            </Box>
          ))}
        </div>
      </div>
    </div>

    {/* RIGHT RAIL */}
    <div style={{
      background: "color-mix(in oklab, var(--panel) 40%, transparent)",
      borderLeft: "1px dashed var(--stroke-faint)",
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      overflowY: "auto"
    }}>
      <div>
        <div className="w-mono" style={{ marginBottom: 6 }}>NOTIFICATIONS · 3</div>
        <div className="w-col" style={{ gap: 6 }}>
          <Box cls="dashed" style={{ padding: 8 }}>
            <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>Kaelen reached lvl 7 — choose theme tier</div>
            <div className="w-mono">character · action required</div>
          </Box>
          <Box cls="dashed" style={{ padding: 8 }}>
            <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>Ancestry feat pending</div>
            <div className="w-mono">13 available · tiefling</div>
          </Box>
          <Box cls="dashed" style={{ padding: 8 }}>
            <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>Base threat approaching</div>
            <div className="w-mono">Greypeak · 4 days</div>
          </Box>
        </div>
      </div>

      <Hr />

      <div>
        <div className="w-mono" style={{ marginBottom: 6 }}>QUICK LEDGER</div>
        <div className="w-col" style={{ gap: 4 }}>
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-sub" style={{ fontSize: 13 }}>Gold</span>
            <span className="w-title" style={{ margin: 0, fontSize: 16 }}>1,284</span>
          </div>
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-sub" style={{ fontSize: 13 }}>XP to level 8</span>
            <span className="w-title" style={{ margin: 0, fontSize: 16 }}>78%</span>
          </div>
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-sub" style={{ fontSize: 13 }}>Mythic Power</span>
            <span className="w-title" style={{ margin: 0, fontSize: 16 }}>4/7</span>
          </div>
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-sub" style={{ fontSize: 13 }}>Notoriety</span>
            <span className="w-title" style={{ margin: 0, fontSize: 16, color: "var(--warn)" }}>42</span>
          </div>
        </div>
      </div>

      <Hr />

      <div>
        <div className="w-mono" style={{ marginBottom: 6 }}>RECENT NPCS</div>
        <div className="w-col" style={{ gap: 6 }}>
          {[
            { n: "Mirabel Kain", d: "missing 12d", c: "warn" },
            { n: "Orin Fairweather", d: "+4 friendly", c: "ok" },
            { n: "Lord Varran", d: "−6 hostile", c: "warn" },
          ].map((p, i) => (
            <div key={i} className="w-row" style={{ gap: 8, padding: 6, border: "1px dashed var(--stroke-faint)", borderRadius: 6 }}>
              <Portrait size={28} />
              <div style={{ flex: 1 }}>
                <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{p.n}</div>
                <div className="w-mono">{p.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Hr />

      <div>
        <div className="w-mono" style={{ marginBottom: 6 }}>CHRONICLE · S14</div>
        <Box cls="dashed" style={{ padding: 10 }}>
          <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 15, lineHeight: 1.4, fontStyle: "italic" }}>
            "They reached Thornveil as the sun set. The gate was already open. The party chose to enter quietly rather than call out…"
          </div>
          <Hr />
          <div className="w-mono">mood: tense</div>
          <div className="w-mono">cliffhanger: two voices</div>
        </Box>
      </div>
    </div>
  </div>
);

const DashV2FullScreen = () => (
  <section className="screen active" data-screen-id="dash-v2-full">
    <div className="section-head">
      <div className="section-title">Dashboard V2 — Full screen</div>
      <div className="section-sub">— sidebar nav · world-pulse forward · right-rail notifications & quick ledger</div>
    </div>
    <DashV2Full />
    <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
      <Box cls="dashed" title="Why this works" sub="">
        <div className="w-sub" style={{ fontSize: 13, lineHeight: 1.5 }}>
          • One primary action (Continue Session) is impossible to miss<br/>
          • Sidebar gives persistent nav without eating horizontal space<br/>
          • World Pulse surfaces what changed since last play — the thing solo-D&D players forget most
        </div>
      </Box>
      <Box cls="dashed" title="What to watch" sub="">
        <div className="w-sub" style={{ fontSize: 13, lineHeight: 1.5 }}>
          • 3-column can feel heavy · right rail may be worth collapsing on narrower screens<br/>
          • Risk of duplicating info (chronicle snippet vs. plot threads)<br/>
          • Sidebar depth — 4 sections might want to be 2 collapsible groups
        </div>
      </Box>
      <Box cls="dashed" title="Natural next moves" sub="">
        <div className="w-sub" style={{ fontSize: 13, lineHeight: 1.5 }}>
          • Try an alt: collapsed sidebar / icons-only<br/>
          • Chronicle as hover-expand instead of snippet<br/>
          • Notifications grouped by "blocks play" vs. "info"<br/>
          • A "today" vs "long-term" view toggle
        </div>
      </Box>
    </div>
  </section>
);

Object.assign(window, { DashV2FullScreen });
