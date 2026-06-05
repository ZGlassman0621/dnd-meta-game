// Winners — full-screen versions with user's picks & remixes
// 1. DM Session = V2 tool-first (polish render hiccups)
// 2. Wizard = V1 stepper (primary), V3 as "Roll next character" secondary
// 3. Sheet = V1 tabbed classic
// 4. Base = V2 map + V3 ops mixed, with real-feeling background
// 5. Merchant = V1 split panel
// 6. NPC = V1 list/detail + V2 graph as secondary view
// 7. Dashboard V2 already has its own file

// ─── 1. DM SESSION · V2 full ─────────────────────────────────────────────
const WinSession = () => (
  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: 0, height: "calc(100vh - 180px)", minHeight: 720, border: "1.5px solid var(--stroke-faint)", borderRadius: 12, overflow: "hidden", background: "var(--bg-2)" }}>
    {/* LEFT */}
    <div style={{ borderRight: "1px dashed var(--stroke-faint)", padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, background: "color-mix(in oklab, var(--panel) 60%, transparent)" }}>
      <Box title="Party" sub="3 members">
        {[{n:"Kaelen",hp:"42/52",c:"accent"},{n:"Mira",hp:"38/44"},{n:"Dorne",hp:"away",c:"warn"}].map((p,i)=>(
          <div key={i} className="w-row" style={{ gap: 8, padding: "6px 4px", borderBottom: i<2?"1px dashed var(--stroke-faint)":"none" }}>
            <Portrait size={32} />
            <div style={{ flex: 1 }}>
              <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{p.n}</div>
              <div className="w-mono">HP {p.hp}</div>
            </div>
            {p.c==="accent" && <Chip accent>you</Chip>}
            {p.c==="warn" && <Chip warn>away</Chip>}
          </div>
        ))}
      </Box>
      <Box title="Conditions" sub="">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <Chip warn>poisoned · 1hr</Chip>
          <Chip accent>concentrating: Hex</Chip>
        </div>
      </Box>
      <Box title="Effects" sub="round counters">
        <div className="w-col" style={{ gap: 4 }}>
          <div className="w-row" style={{ justifyContent: "space-between" }}><span className="w-mono">Bless</span><Chip accent>3 rds</Chip></div>
          <div className="w-row" style={{ justifyContent: "space-between" }}><span className="w-mono">Bane</span><Chip warn>2 rds</Chip></div>
          <div className="w-row" style={{ justifyContent: "space-between" }}><span className="w-mono">Hex → cultist</span><Chip>∞</Chip></div>
        </div>
      </Box>
      <Box title="Active quests">
        <div className="w-col" style={{ gap: 4 }}>
          <Chip accent>[MAIN] Hollow Pact</Chip>
          <Chip>[SIDE] Find Mirabel</Chip>
          <Chip warn>[FACTION] Iron Guild favor</Chip>
        </div>
      </Box>
    </div>

    {/* CENTER */}
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="w-row" style={{ gap: 8, alignItems: "center" }}>
        <Chip accent>Crowned Shadow · S15</Chip>
        <Chip>Thornveil Gate</Chip>
        <Chip warn>⚔ round 3 · init 18</Chip>
        <div style={{ flex: 1 }}></div>
        <Btn ghost>⏸ pause</Btn>
        <Btn ghost>⌘K</Btn>
      </div>
      <div style={{ flex: 1, padding: 14, border: "1.2px dashed var(--stroke-faint)", borderRadius: 10, overflow: "auto", display: "flex", flexDirection: "column", gap: 8, background: "color-mix(in oklab, var(--panel) 30%, transparent)" }}>
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div className="bubble dm"><div className="w-mono" style={{ marginBottom: 2 }}>DM</div>The cultist raises a twisted rod — shadow curls along the length of it. You feel the temperature drop three degrees in a breath.</div>
        </div>
        <div style={{ display: "flex" }}><div className="bubble system">⚔ COMBAT — Cultist rolled initiative 14 · joined turn order</div></div>
        <div style={{ display: "flex", flexDirection: "row-reverse" }}>
          <div className="bubble you">I hit him with Eldritch Blast before he finishes casting. Agonizing Blast + Hex damage.</div>
        </div>
        <div style={{ display: "flex" }}><div className="bubble system">🎲 Attack → 19 vs AC 13 · hit · 1d10+4 + 1d6 necrotic = 14 damage</div></div>
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div className="bubble dm"><div className="w-mono" style={{ marginBottom: 2 }}>DM</div>The beam rips through his shoulder — the rod clatters to the stone. He staggers, snarling in a language you don't recognize. <i>"You… should not have come."</i></div>
        </div>
        <div style={{ display: "flex", flexDirection: "row-reverse" }}>
          <div className="bubble you">Mira, pick up that rod — don't touch the end!</div>
        </div>
      </div>
      <div style={{ border: "1.3px dashed var(--stroke-faint)", borderRadius: 10, padding: 10 }}>
        <div className="w-row" style={{ gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, height: 36, borderRadius: 6, border: "1px dashed var(--stroke-faint)", padding: "8px 10px", fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-dim)" }}>what do you do?</div>
          <Btn>say</Btn>
          <Btn primary>do ↵</Btn>
        </div>
        <div className="w-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <Chip>/roll 1d20+4</Chip>
          <Chip>/ooc</Chip>
          <Chip>/rest short</Chip>
          <Chip>/inventory</Chip>
        </div>
      </div>
    </div>

    {/* RIGHT */}
    <div style={{ borderLeft: "1px dashed var(--stroke-faint)", padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, background: "color-mix(in oklab, var(--panel) 40%, transparent)" }}>
      <Box title="Initiative" sub="round 3">
        <div className="w-col" style={{ gap: 2 }}>
          {[["Mira","22",false],["You","18",true],["Cultist","14",false],["Dorne","11",false]].map(([n,i,a],k) => (
            <div key={k} className="w-row" style={{ padding: "4px 8px", background: a?"color-mix(in oklab, var(--accent) 15%, transparent)":"transparent", borderRadius: 4 }}>
              <span className="w-mono" style={{ flex: 1, color: a?"var(--accent)":"var(--ink-dim)" }}>{n}</span>
              <span className="w-title" style={{ margin: 0, fontSize: 14 }}>{i}</span>
              {a && <span style={{ marginLeft: 6, color: "var(--accent)" }}>▸</span>}
            </div>
          ))}
        </div>
      </Box>
      <Box title="Spell slots" sub="warlock 3rd · 2/2">
        <div className="w-row" style={{ gap: 4 }}>
          {[1,1].map((_,i)=><div key={i} style={{ flex: 1, height: 28, border: "1.2px solid var(--accent)", borderRadius: 4, background: "color-mix(in oklab, var(--accent) 20%, transparent)" }}></div>)}
        </div>
        <Hr />
        <div className="w-sub" style={{ fontSize: 12 }}>Cantrips: Eldritch Blast · Prestidigitation</div>
      </Box>
      <Box title="Prepared" sub="at-will">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          <Chip accent>Eldritch Blast</Chip>
          <Chip>Hex</Chip>
          <Chip>Shield</Chip>
          <Chip>Counterspell</Chip>
          <Chip>Mislead</Chip>
        </div>
      </Box>
      <Box title="Rules" sub="cover · opp. attack">
        <div className="w-col" style={{ gap: 2 }}>
          <div className="w-mono">½ cover → +2 AC/DEX</div>
          <div className="w-mono">¾ cover → +5 AC/DEX</div>
          <div className="w-mono">opp attack: reaction</div>
        </div>
      </Box>
      <Box title="Quick rolls" sub="">
        <div className="grid-2" style={{ gap: 4 }}>
          <Btn>Perception</Btn>
          <Btn>Insight</Btn>
          <Btn>Arcana</Btn>
          <Btn>Stealth</Btn>
        </div>
      </Box>
    </div>
  </div>
);

const WinSessionScreen = () => (
  <section className="screen active" data-screen-id="win-session">
    <div className="section-head">
      <div className="section-title">★ DM Session — V2 full</div>
      <div className="section-sub">— tool-first cockpit · everything visible · chat polished</div>
    </div>
    <WinSession />
  </section>
);

// ─── 2. WIZARD · V1 stepper + V3 as secondary ──────────────────────────
const WinWizard = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 720 }}>
    {/* Toggle bar */}
    <div style={{ display: "flex", gap: 10, padding: 10, border: "1.3px dashed var(--stroke-faint)", borderRadius: 10, background: "color-mix(in oklab, var(--panel) 40%, transparent)" }}>
      <Box cls="accent" style={{ flex: 1, padding: 10 }}>
        <div className="w-mono" style={{ color: "var(--accent)" }}>PRIMARY · SELECTED</div>
        <div className="w-title" style={{ fontSize: 16, margin: "2px 0" }}>Full build · step-by-step</div>
        <div className="w-sub" style={{ fontSize: 12 }}>7 steps · ~15 min · full control</div>
      </Box>
      <Box cls="dashed" style={{ flex: 1, padding: 10 }}>
        <div className="w-mono">SECONDARY</div>
        <div className="w-title" style={{ fontSize: 16, margin: "2px 0" }}>Roll next character <Chip accent>★ new</Chip></div>
        <div className="w-sub" style={{ fontSize: 12 }}>11 story questions · AI builds sheet from your answers</div>
      </Box>
    </div>

    {/* Main wizard body */}
    <div style={{ border: "1.5px solid var(--stroke-faint)", borderRadius: 12, background: "var(--bg-2)", overflow: "hidden" }}>
      <div style={{ padding: "18px 22px", borderBottom: "1px dashed var(--stroke-faint)", background: "color-mix(in oklab, var(--panel) 60%, transparent)" }}>
        <div className="w-row" style={{ gap: 12, marginBottom: 10, justifyContent: "center" }}>
          {["Identity","Ancestry","Class","Abilities","Background","Spells","Review"].map((s, i) => (
            <div key={i} className="w-row" style={{ gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "1.5px solid " + (i <= 2 ? "var(--accent)" : "var(--stroke-faint)"),
                background: i < 2 ? "var(--accent)" : i === 2 ? "color-mix(in oklab, var(--accent) 20%, transparent)" : "transparent",
                color: i < 2 ? "var(--bg)" : i === 2 ? "var(--accent)" : "var(--ink-dim)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--hand)", fontSize: 14, fontWeight: 600
              }}>{i < 2 ? "✓" : i + 1}</div>
              <div className="w-sub" style={{ fontSize: 13, color: i <= 2 ? "var(--ink)" : "var(--ink-dim)" }}>{s}</div>
              {i < 6 && <div style={{ width: 24, height: 1, background: "var(--stroke-faint)", margin: "0 4px" }}></div>}
            </div>
          ))}
        </div>
        <div className="w-mono" style={{ textAlign: "center", color: "var(--ink-dim)" }}>STEP 3 OF 7 · CLASS · SAVED TO LOCAL</div>
      </div>

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1.2fr 1fr 280px", gap: 20 }}>
        {/* Class list */}
        <div>
          <div className="w-title" style={{ fontSize: 22 }}>Choose a class</div>
          <div className="w-sub" style={{ fontSize: 13, marginBottom: 12 }}>your role in the party · determines spell access, hit points, skills</div>
          <div className="w-col" style={{ gap: 6 }}>
            {[
              { c: "Barbarian", hd: "d12", role: "tank · rage", sel: false },
              { c: "Bard", hd: "d8", role: "support · inspire", sel: false },
              { c: "Cleric", hd: "d8", role: "support · heal", sel: false },
              { c: "Druid", hd: "d8", role: "flex · wild shape", sel: false },
              { c: "Fighter", hd: "d10", role: "martial · versatile", sel: false },
              { c: "Monk", hd: "d8", role: "striker · mobile", sel: false },
              { c: "Paladin", hd: "d10", role: "tank/support · oaths", sel: false },
              { c: "Ranger", hd: "d10", role: "striker · nature", sel: false },
              { c: "Rogue", hd: "d8", role: "striker · sneak", sel: false },
              { c: "Sorcerer", hd: "d6", role: "caster · innate", sel: false },
              { c: "Warlock", hd: "d8", role: "caster · pact", sel: true },
              { c: "Wizard", hd: "d6", role: "caster · scholar", sel: false },
            ].map((k, i) => (
              <div key={i} className="w-row" style={{
                padding: "10px 12px",
                border: "1.3px " + (k.sel ? "solid var(--accent)" : "dashed var(--stroke-faint)") ,
                borderRadius: 8,
                background: k.sel ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                gap: 10,
                cursor: "pointer"
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, border: "1.2px dashed var(--stroke-faint)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--hand)", fontSize: 16, color: "var(--ink-dim)" }}>{k.c[0]}</div>
                <div style={{ flex: 1 }}>
                  <div className="w-title" style={{ fontSize: 15, margin: 0 }}>{k.c}</div>
                  <div className="w-mono">{k.role}</div>
                </div>
                <Chip>{k.hd}</Chip>
                {k.sel && <Chip accent>◉ picked</Chip>}
              </div>
            ))}
          </div>
        </div>

        {/* Class detail */}
        <div>
          <div className="w-mono" style={{ marginBottom: 6 }}>CLASS DETAIL</div>
          <Box cls="accent" style={{ padding: 14 }}>
            <div className="w-title" style={{ fontSize: 22, margin: "0 0 4px" }}>Warlock</div>
            <div className="w-sub" style={{ fontSize: 13, color: "var(--ink-dim)" }}>a seeker who traded for power · bound by pact, fed by ritual</div>
            <Hr />
            <div className="w-col" style={{ gap: 4 }}>
              <div className="w-row"><span className="w-mono" style={{ width: 80 }}>hit die</span><span className="w-sub">d8</span></div>
              <div className="w-row"><span className="w-mono" style={{ width: 80 }}>primary</span><span className="w-sub">Charisma</span></div>
              <div className="w-row"><span className="w-mono" style={{ width: 80 }}>saves</span><span className="w-sub">WIS · CHA</span></div>
              <div className="w-row"><span className="w-mono" style={{ width: 80 }}>armor</span><span className="w-sub">light</span></div>
              <div className="w-row"><span className="w-mono" style={{ width: 80 }}>weapons</span><span className="w-sub">simple</span></div>
            </div>
            <Hr />
            <div className="w-sub" style={{ fontSize: 13, marginBottom: 6 }}>Subclass (pick at L3)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <Chip accent>Hexblade ◉</Chip>
              <Chip>Fiend</Chip>
              <Chip>Archfey</Chip>
              <Chip>Great Old One</Chip>
            </div>
            <Hr />
            <div className="w-sub" style={{ fontSize: 13, marginBottom: 6 }}>Key features</div>
            <div className="w-col" style={{ gap: 4 }}>
              <Chip>Pact Magic (short-rest slots)</Chip>
              <Chip>Eldritch Invocations</Chip>
              <Chip>Pact Boon (L3)</Chip>
              <Chip>Mystic Arcanum (L11)</Chip>
            </div>
          </Box>
        </div>

        {/* Live preview */}
        <div>
          <div className="w-mono" style={{ marginBottom: 6 }}>LIVE PREVIEW</div>
          <Box cls="accent-2" style={{ padding: 14 }}>
            <div style={{ textAlign: "center" }}>
              <Portrait size={80} style={{ margin: "4px auto" }} />
              <div className="w-title" style={{ fontSize: 18, margin: "4px 0 0" }}>Kaelen Voss</div>
              <div className="w-sub" style={{ fontSize: 12 }}>Tiefling · Warlock · Lvl 1</div>
            </div>
            <Hr />
            <div className="grid-3" style={{ gap: 4 }}>
              <Stat label="HP" value="9" mod="d8" />
              <Stat label="AC" value="13" mod="lt" />
              <Stat label="SPD" value="30" mod="ft" />
            </div>
            <Hr />
            <div className="w-mono">saves: CHA +6 · WIS +3</div>
            <div className="w-mono">spell DC: 13 · atk: +5</div>
            <Hr />
            <div className="w-sub" style={{ fontSize: 12, color: "var(--warn)" }}>⚠ subclass picked at lvl 3</div>
            <div className="w-sub" style={{ fontSize: 12, color: "var(--warn)" }}>⚠ 2 cantrips + 2 spells pending</div>
          </Box>
          <div className="w-col" style={{ gap: 6, marginTop: 10 }}>
            <Btn primary style={{ justifyContent: "center" }}>continue → Abilities</Btn>
            <Btn ghost style={{ justifyContent: "center" }}>save & exit</Btn>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const WinWizardScreen = () => (
  <section className="screen active" data-screen-id="win-wizard">
    <div className="section-head">
      <div className="section-title">★ Creation Wizard — V1 primary, V3 secondary</div>
      <div className="section-sub">— full build is default · "Roll next character" (V3 story-led) is the alt entrypoint</div>
    </div>
    <WinWizard />
  </section>
);

// ─── 3. CHARACTER SHEET · V1 ─────────────────────────────────────────────
const WinSheet = () => (
  <div style={{ border: "1.5px solid var(--stroke-faint)", borderRadius: 12, background: "var(--bg-2)", padding: 22, minHeight: 720 }}>
    <div className="w-row" style={{ gap: 16, marginBottom: 14 }}>
      <Portrait size={80} />
      <div style={{ flex: 1 }}>
        <div className="w-title" style={{ fontSize: 28, margin: 0 }}>Kaelen Voss</div>
        <div className="w-sub" style={{ fontSize: 14 }}>Tiefling · Warlock (Hexblade) 7 · Noble background · Crowned Shadow</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <Chip accent>HP 42/52</Chip>
          <Chip>AC 15</Chip>
          <Chip>Init +2</Chip>
          <Chip>Spd 30</Chip>
          <Chip>Prof +3</Chip>
          <Chip>HD 3/7 d8</Chip>
          <Chip ok>Insp</Chip>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Btn primary>level up ↑</Btn>
        <Btn ghost>short rest</Btn>
        <Btn ghost>long rest</Btn>
      </div>
    </div>

    <div className="ui-tabs" style={{ marginBottom: 14 }}>
      {["Stats","Combat","Spells","Inventory","Features","Background","Progression","Mythic"].map((t,i) => (
        <div key={i} className={"t" + (i === 0 ? " active" : "")}>{t}</div>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
      <Box title="Abilities" sub="point buy · +2 CHA tiefling">
        <div className="grid-3" style={{ gap: 8 }}>
          {[["STR","10","+0"],["DEX","14","+2"],["CON","14","+2"],["INT","11","+0"],["WIS","12","+1"],["CHA","18","+4"]].map(([l,v,m],i) => (
            <Stat key={i} label={l} value={v} mod={m} />
          ))}
        </div>
      </Box>
      <Box title="Saving throws" sub="proficient · CHA, WIS">
        <div className="w-col" style={{ gap: 3 }}>
          {[["STR","+0",false],["DEX","+2",false],["CON","+2",false],["INT","+0",false],["WIS","+4",true],["CHA","+7",true]].map(([l,m,p],i) => (
            <div key={i} className="w-row" style={{ padding: "3px 6px", borderRadius: 4, background: p?"color-mix(in oklab, var(--accent) 10%, transparent)":"transparent" }}>
              <span style={{ width: 12, color: p?"var(--accent)":"var(--ink-faint)" }}>{p?"●":"○"}</span>
              <span className="w-mono" style={{ flex: 1 }}>{l}</span>
              <span className="w-sub" style={{ fontSize: 13 }}>{m}</span>
            </div>
          ))}
        </div>
      </Box>
      <Box title="Passive senses">
        <div className="w-col" style={{ gap: 4 }}>
          <div className="w-row"><span className="w-mono" style={{ flex: 1 }}>Perception</span><span className="w-title" style={{ margin: 0, fontSize: 18 }}>11</span></div>
          <div className="w-row"><span className="w-mono" style={{ flex: 1 }}>Insight</span><span className="w-title" style={{ margin: 0, fontSize: 18 }}>11</span></div>
          <div className="w-row"><span className="w-mono" style={{ flex: 1 }}>Investigation</span><span className="w-title" style={{ margin: 0, fontSize: 18 }}>10</span></div>
          <Hr />
          <div className="w-mono">darkvision 60ft · devil's sight 120ft (magical dark)</div>
        </div>
      </Box>

      <Box title="Skills" style={{ gridColumn: "span 2" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
          {[
            ["Acrobatics","DEX","+2",false],
            ["Animal Handling","WIS","+1",false],
            ["Arcana","INT","+3",true],
            ["Athletics","STR","+0",false],
            ["Deception","CHA","+7",true],
            ["History","INT","+3",true],
            ["Insight","WIS","+1",false],
            ["Intimidation","CHA","+4",false],
            ["Investigation","INT","+0",false],
            ["Medicine","WIS","+1",false],
            ["Nature","INT","+0",false],
            ["Perception","WIS","+1",false],
            ["Performance","CHA","+4",false],
            ["Persuasion","CHA","+7",true],
            ["Religion","INT","+0",false],
            ["Sleight of Hand","DEX","+2",false],
            ["Stealth","DEX","+2",false],
            ["Survival","WIS","+1",false],
          ].map(([n,a,m,p],i) => (
            <div key={i} className="w-row" style={{ padding: "3px 6px", borderRadius: 4, background: p?"color-mix(in oklab, var(--accent) 10%, transparent)":"transparent", gap: 4 }}>
              <span style={{ width: 10, color: p?"var(--accent)":"var(--ink-faint)", fontSize: 11 }}>{p?"●":"○"}</span>
              <span className="w-sub" style={{ flex: 1, fontSize: 12 }}>{n}</span>
              <span className="w-mono" style={{ fontSize: 10 }}>{a}</span>
              <span className="w-title" style={{ margin: 0, fontSize: 13 }}>{m}</span>
            </div>
          ))}
        </div>
      </Box>

      <Box title="Languages & proficiencies">
        <div className="w-mono" style={{ marginBottom: 4 }}>LANGUAGES</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          <Chip>Common</Chip><Chip>Infernal</Chip><Chip>Elvish</Chip>
        </div>
        <div className="w-mono" style={{ marginBottom: 4 }}>ARMOR & WEAPONS</div>
        <div className="w-sub" style={{ fontSize: 12 }}>light, medium armor · shields · simple & martial weapons (Hexblade)</div>
        <Hr />
        <div className="w-mono" style={{ marginBottom: 4 }}>TOOLS</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Chip>Gaming set (dragonchess)</Chip>
          <Chip>Calligrapher's supplies</Chip>
        </div>
      </Box>
    </div>
    <div className="w-mono" style={{ textAlign: "center", marginTop: 16, color: "var(--ink-faint)" }}>
      — Stats tab shown · switch tabs for Combat, Spells, Inventory, Features, Background, Progression, Mythic —
    </div>
  </div>
);

const WinSheetScreen = () => (
  <section className="screen active" data-screen-id="win-sheet">
    <div className="section-head">
      <div className="section-title">★ Character Sheet — V1 full</div>
      <div className="section-sub">— paper-style · 8 tabs · first tab (Stats) expanded</div>
    </div>
    <WinSheet />
  </section>
);

// ─── 4. PARTY BASE · V2 map + V3 ops (remix) ─────────────────────────────
const WinBase = () => (
  <div style={{ border: "1.5px solid var(--stroke-faint)", borderRadius: 12, background: "var(--bg-2)", overflow: "hidden", minHeight: 720, display: "flex", flexDirection: "column" }}>
    {/* Header: ops-style KPI strip (from V3) */}
    <div style={{ padding: 16, borderBottom: "1px dashed var(--stroke-faint)", background: "color-mix(in oklab, var(--panel) 50%, transparent)" }}>
      <div className="w-row" style={{ gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="w-mono">MARTIAL · KEEP · PRIMARY</div>
          <div className="w-title" style={{ fontSize: 26, margin: "2px 0" }}>Greypeak Hold</div>
          <div className="w-sub" style={{ fontSize: 13 }}>perched on the north ridge of the Thornveil · held 42 days</div>
        </div>
        <Box style={{ padding: 10, minWidth: 110, textAlign: "center" }}>
          <div className="w-mono">DEFENSE</div>
          <div className="w-title" style={{ fontSize: 26, margin: 0 }}>14</div>
        </Box>
        <Box style={{ padding: 10, minWidth: 110, textAlign: "center" }}>
          <div className="w-mono">GARRISON</div>
          <div className="w-title" style={{ fontSize: 26, margin: 0 }}>4/8</div>
        </Box>
        <Box style={{ padding: 10, minWidth: 110, textAlign: "center" }}>
          <div className="w-mono">TREASURY</div>
          <div className="w-title" style={{ fontSize: 26, margin: 0 }}>1,284<span style={{ fontSize: 12, color: "var(--ink-dim)" }}>gp</span></div>
        </Box>
        <Box cls="warn" style={{ padding: 10, minWidth: 110, textAlign: "center" }}>
          <div className="w-mono" style={{ color: "var(--warn)" }}>RAID IN</div>
          <div className="w-title" style={{ fontSize: 26, margin: 0, color: "var(--warn)" }}>4d</div>
        </Box>
      </div>
    </div>

    {/* Body: map (V2) + ops ledger side panel (V3) */}
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 0, flex: 1, minHeight: 520 }}>
      {/* MAP */}
      <div style={{
        position: "relative",
        minHeight: 520,
        overflow: "hidden",
        background: `
          radial-gradient(ellipse at 30% 40%, color-mix(in oklab, var(--ok) 18%, transparent), transparent 45%),
          radial-gradient(ellipse at 75% 70%, color-mix(in oklab, var(--accent-2) 12%, transparent), transparent 50%),
          radial-gradient(ellipse at 50% 15%, color-mix(in oklab, var(--stroke-faint) 40%, transparent), transparent 40%),
          repeating-linear-gradient(45deg, color-mix(in oklab, var(--ink-dim) 6%, transparent) 0 3px, transparent 3px 8px),
          var(--bg-2)
        `
      }}>
        {/* Contour hint lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.4 }}>
          <defs>
            <pattern id="contour" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M0,30 Q15,10 30,30 T60,30" stroke="var(--stroke-faint)" strokeWidth="1" fill="none" strokeDasharray="3 4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contour)" />
          {/* River */}
          <path d="M 0 70% Q 30% 60% 50% 75% T 100% 80%" stroke="var(--accent)" strokeWidth="3" fill="none" opacity="0.5" />
          {/* Road */}
          <path d="M 100% 10% Q 60% 30% 50% 45% T 0% 90%" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="6 4" fill="none" opacity="0.6" />
          {/* Raid direction arrow */}
          <path d="M 95% 15% L 55% 42%" stroke="var(--warn)" strokeWidth="2.5" strokeDasharray="8 4" fill="none" />
          <polygon points="0,-6 10,0 0,6" transform="translate(55%, 42%) rotate(145)" fill="var(--warn)" />
        </svg>

        {/* Terrain labels */}
        <div style={{ position: "absolute", top: "8%", left: "10%", fontFamily: "var(--note)", fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic" }}>Greypeak Ridge</div>
        <div style={{ position: "absolute", top: "82%", left: "20%", fontFamily: "var(--note)", fontSize: 13, color: "var(--accent)", fontStyle: "italic", opacity: 0.8 }}>~ Vern R. ~</div>
        <div style={{ position: "absolute", top: "15%", right: "8%", fontFamily: "var(--note)", fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>Thornveil Wood</div>
        <div style={{ position: "absolute", top: "60%", right: "15%", fontFamily: "var(--note)", fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}>Iron Road →</div>

        {/* Building markers */}
        {[
          { t: "Keep", x: 45, y: 45, s: "done", w: 66 },
          { t: "Watchtower", x: 22, y: 28, s: "building", w: 76 },
          { t: "Barracks", x: 66, y: 58, s: "done", w: 72 },
          { t: "Smithy", x: 32, y: 66, s: "done", w: 62 },
          { t: "Chapel", x: 58, y: 28, s: "done", w: 62 },
          { t: "+ build", x: 78, y: 38, s: "empty", w: 68 },
          { t: "+ build", x: 26, y: 82, s: "empty", w: 68 }
        ].map((b, i) => (
          <div key={i} style={{
            position: "absolute", left: `${b.x}%`, top: `${b.y}%`,
            transform: "translate(-50%, -50%)",
            padding: "6px 10px",
            border: "1.4px " + (b.s === "empty" ? "dashed var(--stroke-faint)" : "solid " + (b.s === "building" ? "var(--accent)" : "var(--stroke)")),
            background: b.s === "building"
              ? "color-mix(in oklab, var(--accent) 20%, var(--bg-2))"
              : b.s === "empty"
                ? "color-mix(in oklab, var(--bg-2) 90%, transparent)"
                : "var(--panel)",
            borderRadius: 6,
            fontFamily: "var(--hand)",
            fontSize: 13,
            textAlign: "center",
            width: b.w,
            boxShadow: b.s === "done" ? "2px 2px 0 color-mix(in oklab, var(--stroke) 30%, transparent)" : "none",
            cursor: "pointer",
            color: b.s === "empty" ? "var(--ink-dim)" : "var(--ink)"
          }}>
            {b.t}
            {b.s === "building" && <div className="w-mono" style={{ fontSize: 9, color: "var(--accent)" }}>14 days</div>}
            {b.s === "done" && <div className="w-mono" style={{ fontSize: 9 }}>built</div>}
          </div>
        ))}

        {/* You are here marker on keep */}
        <div style={{ position: "absolute", left: "45%", top: "45%", transform: "translate(-50%, -50%)", width: 94, height: 40, borderRadius: 20, border: "1.5px dashed var(--accent)", pointerEvents: "none", opacity: 0.6 }}></div>

        {/* Raid origin */}
        <div style={{ position: "absolute", top: "10%", right: "5%", padding: "6px 10px", background: "color-mix(in oklab, var(--warn) 20%, var(--bg-2))", border: "1.4px dashed var(--warn)", borderRadius: 6, maxWidth: 180 }}>
          <div className="w-mono" style={{ color: "var(--warn)", fontSize: 10 }}>⚠ APPROACHING</div>
          <div className="w-sub" style={{ fontSize: 12, color: "var(--warn)" }}>Scarred Wolves</div>
          <div className="w-mono" style={{ fontSize: 10 }}>18 raiders · ETA 4d</div>
        </div>

        {/* Map legend */}
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 6 }}>
          <Chip>📍 click to build</Chip>
          <Chip>🔍 zoom</Chip>
          <Chip>🗺 world</Chip>
        </div>
      </div>

      {/* OPS LEDGER SIDE */}
      <div style={{ borderLeft: "1px dashed var(--stroke-faint)", padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, background: "color-mix(in oklab, var(--panel) 30%, transparent)" }}>
        <div className="ui-tabs">
          <div className="t active">Buildings</div>
          <div className="t">Garrison</div>
          <div className="t">Threats</div>
          <div className="t">Ledger</div>
        </div>

        <Box title="Buildings — status" sub="4 done · 1 building · 2 empty">
          <div className="w-col" style={{ gap: 5 }}>
            {[
              { t: "Keep", s: "done", p: 100 },
              { t: "Barracks", s: "done", p: 100 },
              { t: "Smithy", s: "done", p: 100 },
              { t: "Chapel", s: "done", p: 100 },
              { t: "Watchtower", s: "building", p: 40 },
              { t: "—", s: "empty", p: 0 },
              { t: "—", s: "empty", p: 0 }
            ].map((b, i) => (
              <div key={i} className="w-row" style={{ gap: 6 }}>
                <div style={{ width: 84 }} className="w-sub">{b.t}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--stroke-faint)", overflow: "hidden" }}>
                  <div style={{ width: b.p + "%", height: "100%", background: b.s === "done" ? "var(--ok)" : b.s === "building" ? "var(--accent)" : "transparent" }}></div>
                </div>
                <Chip ok={b.s === "done"} accent={b.s === "building"}>{b.s}</Chip>
              </div>
            ))}
          </div>
        </Box>

        <Box title="Upcoming events">
          <div className="w-col" style={{ gap: 5 }}>
            <div className="w-row"><Chip warn>−4d</Chip><span className="w-sub" style={{ fontSize: 12 }}>Scarred Wolves raid (18 raiders)</span></div>
            <div className="w-row"><Chip accent>−14d</Chip><span className="w-sub" style={{ fontSize: 12 }}>Watchtower complete</span></div>
            <div className="w-row"><Chip>−30d</Chip><span className="w-sub" style={{ fontSize: 12 }}>Tax collection · renown check</span></div>
            <div className="w-row"><Chip>−45d</Chip><span className="w-sub" style={{ fontSize: 12 }}>Iron Guild caravan</span></div>
          </div>
        </Box>

        <Box title="Daily ledger">
          <div className="w-col" style={{ gap: 3 }}>
            <div className="w-row" style={{ justifyContent: "space-between" }}><span className="w-mono">income</span><span className="w-sub" style={{ color: "var(--ok)" }}>+22 gp</span></div>
            <div className="w-row" style={{ justifyContent: "space-between" }}><span className="w-mono">upkeep</span><span className="w-sub" style={{ color: "var(--warn)" }}>−10 gp</span></div>
            <Hr />
            <div className="w-row" style={{ justifyContent: "space-between" }}><span className="w-mono">net</span><span className="w-title" style={{ margin: 0, fontSize: 16, color: "var(--accent)" }}>+12 gp/d</span></div>
          </div>
        </Box>

        <Btn primary style={{ justifyContent: "center" }}>⚔ plan raid defense</Btn>
      </div>
    </div>
  </div>
);

const WinBaseScreen = () => (
  <section className="screen active" data-screen-id="win-base">
    <div className="section-head">
      <div className="section-title">★ Party Base — V2 map × V3 ops (mixed)</div>
      <div className="section-sub">— spatial map with terrain (river, road, contours) + ops ledger side panel</div>
    </div>
    <WinBase />
  </section>
);

// ─── 5. MERCHANT · V1 ────────────────────────────────────────────────────
const WinMerchant = () => (
  <div style={{ border: "1.5px solid var(--stroke-faint)", borderRadius: 12, background: "var(--bg-2)", padding: 22, minHeight: 720 }}>
    <div className="w-row" style={{ marginBottom: 14, gap: 12 }}>
      <Portrait size={56} />
      <div style={{ flex: 1 }}>
        <div className="w-title" style={{ fontSize: 22, margin: 0 }}>Orin Fairweather</div>
        <div className="w-sub" style={{ fontSize: 13 }}>halfling · general goods · Thornveil · disposition: friendly (+4)</div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <Chip ok>loyal tier 2 · 5% off</Chip>
          <Chip>trust +2</Chip>
          <Chip warn>rumor: underpaying on pelts</Chip>
        </div>
      </div>
      <Chip accent style={{ fontSize: 14, padding: "6px 14px" }}>Gold 1,284</Chip>
    </div>

    <div className="ui-tabs" style={{ marginBottom: 14 }}>
      {["Wares (12)","Commission","Haggle","Talk"].map((t,i)=>(
        <div key={i} className={"t" + (i === 0 ? " active" : "")}>{t}</div>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18 }}>
      <div>
        <div className="w-row" style={{ marginBottom: 8, alignItems: "baseline" }}>
          <div className="w-title" style={{ fontSize: 18, margin: 0 }}>Orin's wares</div>
          <div className="w-mono" style={{ marginLeft: 8 }}>restocks every 7 days · 12 items</div>
          <div style={{ flex: 1 }}></div>
          <div className="w-row" style={{ gap: 4 }}>
            <Chip>all</Chip><Chip accent>common</Chip><Chip>uncommon</Chip><Chip>rare</Chip>
          </div>
        </div>
        <div className="w-col" style={{ gap: 4 }}>
          {[
            { t: "Rations (×7)", p: "5 gp", r: "common", c: "" },
            { t: "Healing Potion", p: "42 gp", r: "uncommon", c: "" },
            { t: "Rope, silk (50ft)", p: "8 gp", r: "common", c: "" },
            { t: "Thieves' Tools", p: "22 gp", r: "common", c: "" },
            { t: "Cloak of Billowing", p: "135 gp", r: "uncommon", c: "" },
            { t: "Oil of Slipperiness", p: "480 gp", r: "rare", c: "" },
            { t: "Boots of Elvenkind", p: "3,200 gp", r: "uncommon", c: "" },
            { t: "Blade of Whispers*", p: "— ask", r: "???", c: "warn" },
            { t: "Hooded Lantern", p: "5 gp", r: "common", c: "" },
            { t: "Crowbar", p: "2 gp", r: "common", c: "" },
          ].map((r, i) => (
            <div key={i} className="w-row" style={{ padding: "8px 10px", border: "1px dashed var(--stroke-faint)", borderRadius: 6, gap: 10, background: r.c === "warn" ? "color-mix(in oklab, var(--warn) 5%, transparent)" : "transparent" }}>
              <div style={{ width: 32, height: 32, border: "1.2px dashed var(--stroke-faint)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-dim)" }}>◇</div>
              <div style={{ flex: 1 }}>
                <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{r.t}</div>
                <div className="w-mono" style={{ color: r.c === "warn" ? "var(--warn)" : "var(--ink-dim)" }}>{r.r}{r.c === "warn" ? " · ⚠ unidentified" : ""}</div>
              </div>
              <div className="w-title" style={{ margin: 0, fontSize: 15, color: r.p.startsWith("—") ? "var(--warn)" : "var(--accent)" }}>{r.p}</div>
              <Btn>buy</Btn>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="w-row" style={{ marginBottom: 8, alignItems: "baseline" }}>
          <div className="w-title" style={{ fontSize: 18, margin: 0 }}>Your bag</div>
          <div className="w-mono" style={{ marginLeft: 8 }}>34 / 120 lbs · on Kaelen</div>
        </div>
        <div className="w-col" style={{ gap: 4 }}>
          {[
            { t: "Pact Blade +1", w: "3 lbs", s: "★ equipped" },
            { t: "Studded Leather", w: "13 lbs", s: "★ equipped" },
            { t: "Rations (×4)", w: "4 lbs", s: "" },
            { t: "Potion of Climbing", w: "0.5 lbs", s: "" },
            { t: "Hex Tome (ritual book)", w: "2 lbs", s: "" },
            { t: "Arcane Focus — rod", w: "2 lbs", s: "" },
            { t: "Coin pouch", w: "3 lbs", s: "1,284 gp · 82 sp" },
            { t: "Silver pelt (from bear)", w: "6 lbs", s: "sellable" },
          ].map((r, i) => (
            <div key={i} className="w-row" style={{ padding: "8px 10px", border: "1px dashed var(--stroke-faint)", borderRadius: 6, gap: 10 }}>
              <div style={{ width: 32, height: 32, border: "1.2px dashed var(--stroke-faint)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-dim)" }}>◇</div>
              <div style={{ flex: 1 }}>
                <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{r.t}</div>
                <div className="w-mono">{r.w}{r.s ? " · " + r.s : ""}</div>
              </div>
              <Btn ghost>sell</Btn>
            </div>
          ))}
        </div>

        <Box cls="dashed" style={{ marginTop: 14, padding: 12 }}>
          <div className="w-row">
            <div style={{ flex: 1 }}>
              <div className="w-title" style={{ margin: 0, fontSize: 14 }}>Cart</div>
              <div className="w-mono">2 items · 47 gp · 5% loyalty discount</div>
            </div>
            <Btn ghost>haggle · DC 13</Btn>
            <Btn primary>confirm buy</Btn>
          </div>
        </Box>
      </div>
    </div>
  </div>
);

const WinMerchantScreen = () => (
  <section className="screen active" data-screen-id="win-merchant">
    <div className="section-head">
      <div className="section-title">★ Merchant — V1 full</div>
      <div className="section-sub">— classic split · wares left · bag right · cart footer</div>
    </div>
    <WinMerchant />
  </section>
);

// ─── 6. NPC CODEX · V1 + V2 graph secondary ───────────────────────────
const WinNpc = () => {
  const [view, setView] = React.useState("list");
  return (
    <div style={{ border: "1.5px solid var(--stroke-faint)", borderRadius: 12, background: "var(--bg-2)", minHeight: 720, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 14, borderBottom: "1px dashed var(--stroke-faint)", background: "color-mix(in oklab, var(--panel) 50%, transparent)" }}>
        <div className="w-row" style={{ gap: 10 }}>
          <div className="w-title" style={{ fontSize: 20, margin: 0 }}>NPC Codex</div>
          <div className="w-mono">47 known · 3 missing · 2 deceased</div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: "flex", background: "var(--bg-2)", border: "1.3px dashed var(--stroke-faint)", borderRadius: 8, padding: 2 }}>
            <div onClick={() => setView("list")} style={{ padding: "4px 10px", fontFamily: "var(--hand)", fontSize: 14, cursor: "pointer", borderRadius: 6, background: view === "list" ? "color-mix(in oklab, var(--accent) 15%, transparent)" : "transparent", color: view === "list" ? "var(--accent)" : "var(--ink-dim)" }}>☰ List</div>
            <div onClick={() => setView("graph")} style={{ padding: "4px 10px", fontFamily: "var(--hand)", fontSize: 14, cursor: "pointer", borderRadius: 6, background: view === "graph" ? "color-mix(in oklab, var(--accent) 15%, transparent)" : "transparent", color: view === "graph" ? "var(--accent)" : "var(--ink-dim)" }}>⁂ Graph</div>
          </div>
        </div>
      </div>

      {view === "list" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 0, flex: 1 }}>
          <div style={{ borderRight: "1px dashed var(--stroke-faint)", padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <Box cls="dashed" style={{ padding: 10 }}>
              <div className="w-row">
                <span className="w-mono">⌕</span>
                <span className="w-sub" style={{ marginLeft: 8, color: "var(--ink-dim)", flex: 1 }}>search 47 NPCs…</span>
              </div>
            </Box>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <Chip accent>all</Chip><Chip>allies</Chip><Chip>enemies</Chip><Chip>merchants</Chip><Chip warn>missing</Chip><Chip>deceased</Chip><Chip>party</Chip>
            </div>
            <Box style={{ padding: 0 }}>
              {[
                { n: "Mirabel Kain", r: "ally · innkeeper", d: "missing 12d", c: "warn", sel: true },
                { n: "Orin Fairweather", r: "merchant", d: "+4 friendly", c: "ok" },
                { n: "Lord Varran", r: "enemy · noble", d: "−6 hostile", c: "warn" },
                { n: "Sister Ysa", r: "ally · cleric", d: "+5 devoted", c: "ok" },
                { n: "The Grey Wolf", r: "rumor", d: "unknown", c: "" },
                { n: "Dorne Ironshield", r: "party · fighter", d: "loyal", c: "ok" },
                { n: "Jessa Crow", r: "ally · scout", d: "+3 friendly", c: "" },
                { n: "Magistrate Vell", r: "enemy", d: "−3 cold", c: "warn" },
              ].map((p, i) => (
                <div key={i} className="w-row" style={{ padding: 10, borderBottom: i < 7 ? "1px dashed var(--stroke-faint)" : "none", background: p.sel ? "color-mix(in oklab, var(--accent) 10%, transparent)" : "transparent", cursor: "pointer" }}>
                  <Portrait size={36} />
                  <div style={{ flex: 1, marginLeft: 10 }}>
                    <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{p.n}</div>
                    <div className="w-mono">{p.r}</div>
                  </div>
                  <Chip warn={p.c === "warn"} ok={p.c === "ok"}>{p.d}</Chip>
                </div>
              ))}
            </Box>
          </div>

          <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
            <Box cls="accent" style={{ padding: 16 }}>
              <div className="w-row" style={{ gap: 14 }}>
                <Portrait size={72} />
                <div style={{ flex: 1 }}>
                  <div className="w-title" style={{ fontSize: 24, margin: 0 }}>Mirabel Kain</div>
                  <div className="w-sub" style={{ fontSize: 13 }}>human · bard (college of lore) · innkeeper of the Crooked Oak</div>
                  <div className="w-row" style={{ gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    <Chip warn>missing · 12 days</Chip>
                    <Chip ok>+7 trust</Chip>
                    <Chip>last seen: Thornveil</Chip>
                    <Chip accent>plot-critical</Chip>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Btn ghost>view in graph →</Btn>
                  <Btn ghost>edit facts</Btn>
                </div>
              </div>
            </Box>

            <div className="grid-2">
              <Box title="Voice" sub="AI-extracted from 6 sessions">
                <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 16, fontStyle: "italic", lineHeight: 1.5 }}>
                  "Always tips the chair before sitting. Speaks softly when angry. Tells the same joke about a fisherman three different ways depending on the audience."
                </div>
              </Box>
              <Box title="Personality">
                <div className="w-col" style={{ gap: 4 }}>
                  <div className="w-mono">loyal · cagey · sentimental</div>
                  <div className="w-mono">motive: protecting her brother</div>
                  <div className="w-mono">mannerism: hums when lying</div>
                </div>
              </Box>
            </div>

            <div className="grid-2">
              <Box title="Promises & debts" sub="unresolved">
                <div className="w-col" style={{ gap: 6 }}>
                  <div className="w-row"><Chip accent>OWES</Chip><span className="w-sub" style={{ fontSize: 12 }}>Kaelen: a truth about House Varran (made S7)</span></div>
                  <div className="w-row"><Chip>OWED</Chip><span className="w-sub" style={{ fontSize: 12 }}>Kaelen promised to investigate her brother (S9)</span></div>
                </div>
              </Box>
              <Box title="Last conversation" sub="S13 · 2 weeks ago">
                <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 15, fontStyle: "italic", lineHeight: 1.5 }}>
                  "…if I'm not back by the frost moon, burn the letters in the drawer."
                </div>
                <Hr />
                <div className="w-mono">tone: urgent · topics: letters, frost moon, departure</div>
              </Box>
            </div>

            <Box title="Connections" sub="3 NPCs · 1 faction">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip>↳ Orin Fairweather (cousin)</Chip>
                <Chip warn>↳ Lord Varran (debt · hostile)</Chip>
                <Chip>↳ Dorne Ironshield (drinking friend)</Chip>
                <Chip accent>🏛 Guild of Iron (sympathizer)</Chip>
              </div>
              <Hr />
              <div className="w-mono" style={{ color: "var(--accent)" }}>→ open graph view to see full web</div>
            </Box>
          </div>
        </div>
      )}

      {view === "graph" && (
        <div style={{ padding: 20, flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          <div style={{ position: "relative", borderRadius: 10, border: "1.4px dashed var(--stroke-faint)", background: "radial-gradient(circle at center, color-mix(in oklab, var(--accent) 5%, transparent), transparent 60%)" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              <line x1="50%" y1="50%" x2="25%" y2="28%" stroke="var(--ok)" strokeWidth="2" strokeDasharray="4 3" />
              <line x1="50%" y1="50%" x2="72%" y2="30%" stroke="var(--warn)" strokeWidth="2" strokeDasharray="4 3" />
              <line x1="50%" y1="50%" x2="28%" y2="72%" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
              <line x1="50%" y1="50%" x2="76%" y2="70%" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
              <line x1="25%" y1="28%" x2="28%" y2="72%" stroke="var(--stroke-faint)" strokeWidth="1.3" strokeDasharray="2 3" />
              <line x1="72%" y1="30%" x2="76%" y2="70%" stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="3 3" />
              <line x1="25%" y1="28%" x2="72%" y2="30%" stroke="var(--stroke-faint)" strokeWidth="1" strokeDasharray="2 4" />
            </svg>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid var(--accent)", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="w-title" style={{ margin: 0, fontSize: 16 }}>you</span>
              </div>
              <div className="w-mono" style={{ marginTop: 4 }}>Kaelen</div>
            </div>
            {[
              { n: "Mirabel", x: "25%", y: "28%", tag: "ally · missing", c: "warn" },
              { n: "Varran", x: "72%", y: "30%", tag: "enemy", c: "warn" },
              { n: "Orin", x: "28%", y: "72%", tag: "merchant", c: "accent" },
              { n: "Ysa", x: "76%", y: "70%", tag: "ally", c: "accent" }
            ].map((p, i) => (
              <div key={i} style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", textAlign: "center" }}>
                <Portrait size={52} style={{ margin: "0 auto" }} />
                <div className="w-sub" style={{ fontSize: 12, marginTop: 2 }}>{p.n}</div>
                <Chip accent={p.c === "accent"} ok={p.c === "ok"} warn={p.c === "warn"}>{p.tag}</Chip>
              </div>
            ))}
            <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
              <Chip>factions</Chip><Chip accent>people</Chip><Chip>locations</Chip><Chip>drag · zoom</Chip>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Box title="Selected: Mirabel Kain" sub="from list view">
              <div className="w-row" style={{ gap: 10 }}>
                <Portrait size={44} />
                <div style={{ flex: 1 }}>
                  <div className="w-sub" style={{ fontSize: 13 }}>4 edges · 1 faction</div>
                  <div className="w-mono">warm · cagey · missing</div>
                </div>
              </div>
            </Box>
            <Box title="Edges" sub="by disposition">
              <div className="w-col" style={{ gap: 4 }}>
                <div className="w-row"><Chip ok>+</Chip><span className="w-sub" style={{ fontSize: 12 }}>Kaelen (+7 trust)</span></div>
                <div className="w-row"><Chip>≈</Chip><span className="w-sub" style={{ fontSize: 12 }}>Orin (cousin)</span></div>
                <div className="w-row"><Chip warn>−</Chip><span className="w-sub" style={{ fontSize: 12 }}>Varran (debt)</span></div>
                <div className="w-row"><Chip>≈</Chip><span className="w-sub" style={{ fontSize: 12 }}>Dorne (drinking)</span></div>
              </div>
            </Box>
            <Box cls="dashed" title="Legend">
              <div className="w-col" style={{ gap: 3 }}>
                <div className="w-row"><div style={{ width: 20, height: 2, background: "var(--ok)" }}></div><span className="w-mono">ally</span></div>
                <div className="w-row"><div style={{ width: 20, height: 2, background: "var(--warn)" }}></div><span className="w-mono">enemy</span></div>
                <div className="w-row"><div style={{ width: 20, height: 2, background: "var(--accent)" }}></div><span className="w-mono">relationship</span></div>
              </div>
            </Box>
          </div>
        </div>
      )}
    </div>
  );
};

const WinNpcScreen = () => (
  <section className="screen active" data-screen-id="win-npc">
    <div className="section-head">
      <div className="section-title">★ NPC Codex — V1 primary × V2 graph (toggle)</div>
      <div className="section-sub">— list/detail is default · toggle to graph when the web gets tangled</div>
    </div>
    <WinNpc />
  </section>
);

Object.assign(window, {
  WinSessionScreen,
  WinWizardScreen,
  WinSheetScreen,
  WinBaseScreen,
  WinMerchantScreen,
  WinNpcScreen,
});
