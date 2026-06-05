// Character Creation Wizard — 3 variations

const WizV1_Steps = () => (
  <Artboard title="V1 — Linear stepper" label="conventional · safe" wide>
    <div className="w-row" style={{ gap: 8, marginBottom: 14, justifyContent: "center" }}>
      {["Identity","Ancestry","Class","Abilities","Background","Spells","Review"].map((s, i) => (
        <div key={i} className="w-row" style={{ gap: 4 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "1.5px solid " + (i <= 2 ? "var(--accent)" : "var(--stroke-faint)"),
            background: i <= 1 ? "var(--accent)" : "transparent",
            color: i <= 1 ? "var(--bg)" : "var(--ink-dim)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--hand)", fontSize: 13
          }}>{i+1}</div>
          <div className="w-sub" style={{ fontSize: 12, color: i <= 2 ? "var(--ink)" : "var(--ink-dim)" }}>{s}</div>
          {i < 6 && <div style={{ width: 20, height: 1, background: "var(--stroke-faint)", margin: "0 4px" }}></div>}
        </div>
      ))}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Box title="Choose a Class" sub="step 3 of 7">
        <div className="w-col" style={{ gap: 6, marginTop: 6 }}>
          {["Barbarian","Bard","Cleric","Druid","Fighter","Warlock ◉","Wizard"].map((c,i) => (
            <div key={i} className="w-row" style={{
              padding: "8px 10px",
              border: "1.3px " + (c.includes("◉") ? "solid var(--accent)" : "dashed var(--stroke-faint)"),
              borderRadius: 6,
              background: c.includes("◉") ? "color-mix(in oklab, var(--accent) 10%, transparent)" : "transparent"
            }}>
              <div className="w-title" style={{ fontSize: 15, margin: 0 }}>{c}</div>
              <div style={{ flex: 1 }} />
              <Chip>d8 HD</Chip>
            </div>
          ))}
        </div>
      </Box>
      <Box title="Warlock" sub="Hexblade · pact of the blade">
        <Ph /><Ph /><Ph w="med" />
        <Hr />
        <div className="w-sub">Class features</div>
        <div className="w-col" style={{ marginTop: 6, gap: 4 }}>
          <Chip>Hex</Chip>
          <Chip>Pact Boon</Chip>
          <Chip>Eldritch Invocations</Chip>
        </div>
      </Box>
    </div>
    <div className="w-row" style={{ marginTop: 14, justifyContent: "space-between" }}>
      <Btn ghost>← back</Btn>
      <Btn primary>continue →</Btn>
    </div>
    <Annot style={{ top: 18, right: 16 }}>safe bet — but 7 screens felt like 14</Annot>
  </Artboard>
);

const WizV2_OnePage = () => (
  <Artboard title="V2 — Single scroll, live preview" label="fewer clicks · everything visible" wide>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, height: 520, overflow: "hidden" }}>
      <div className="w-col" style={{ overflowY: "auto" }}>
        <Box title="1 · Who are you?">
          <div className="w-row" style={{ gap: 8 }}>
            <Box cls="dashed" style={{ flex: 1, padding: 6 }}><span className="w-mono">name</span><br/><span className="w-sub">Kaelen Voss</span></Box>
            <Box cls="dashed" style={{ flex: 1, padding: 6 }}><span className="w-mono">pronouns</span><br/><span className="w-sub">he/him</span></Box>
          </div>
        </Box>
        <Box title="2 · Ancestry">
          <div className="w-row" style={{ gap: 6, flexWrap: "wrap" }}>
            {["Human","Elf","Dwarf","Tiefling ◉","Halfling","Dragonborn","Warforged","Gnome"].map((a,i) => (
              <Chip key={i} accent={a.includes("◉")}>{a}</Chip>
            ))}
          </div>
        </Box>
        <Box title="3 · Class">
          <div className="w-row" style={{ gap: 6, flexWrap: "wrap" }}>
            {["Fighter","Rogue","Cleric","Wizard","Warlock ◉","Paladin","…more"].map((a,i) => (
              <Chip key={i} accent={a.includes("◉")}>{a}</Chip>
            ))}
          </div>
        </Box>
        <Box title="4 · Abilities" sub="point buy · 27">
          <div className="grid-3" style={{ gap: 6 }}>
            <Stat label="STR" value="10" mod="+0" />
            <Stat label="DEX" value="14" mod="+2" />
            <Stat label="CON" value="14" mod="+2" />
            <Stat label="INT" value="11" mod="+0" />
            <Stat label="WIS" value="12" mod="+1" />
            <Stat label="CHA" value="18" mod="+4" />
          </div>
        </Box>
        <Box title="5 · Background & Backstory">
          <div className="w-mono">paste freeform — AI parses it</div>
          <Box cls="dashed" style={{ marginTop: 6, padding: 8, minHeight: 50 }}>
            <Ph /><Ph w="med" />
          </Box>
        </Box>
      </div>
      <div className="w-col" style={{ position: "sticky", top: 0 }}>
        <Box cls="accent-2" title="Live preview">
          <Portrait size={70} style={{ margin: "4px auto" }} />
          <div className="w-title" style={{ textAlign: "center", fontSize: 18 }}>Kaelen Voss</div>
          <div className="w-sub" style={{ textAlign: "center" }}>Tiefling · Warlock · Lvl 1</div>
          <Hr />
          <div className="w-mono">HP 9 · AC 13 · Spd 30</div>
          <div className="w-mono">saves: CHA +6 · WIS +3</div>
        </Box>
        <Box cls="dashed" title="Warnings">
          <div className="w-sub" style={{ color: "var(--warn)", fontSize: 12 }}>⚠ pick a subclass by lvl 3</div>
          <div className="w-sub" style={{ color: "var(--warn)", fontSize: 12 }}>⚠ cantrips missing</div>
        </Box>
        <Btn primary>Finish & create</Btn>
      </div>
    </div>
    <Annot style={{ top: 40, right: 300 }}>scroll, don't click-click-click</Annot>
  </Artboard>
);

const WizV3_Guided = () => (
  <Artboard title="V3 — Story-led prompt" label="novel · interview style" wide>
    <div style={{ textAlign: "center", margin: "10px 0 20px" }}>
      <div className="w-mono" style={{ color: "var(--ink-dim)" }}>QUESTION 3 OF 11 · TAKES ABOUT 5 MIN</div>
      <div className="w-title" style={{ fontSize: 26, margin: "10px 0" }}>What did the world take from you?</div>
      <div className="w-sub" style={{ fontSize: 14 }}>the answer shapes your starting theme, a seeded NPC, and your first chapter</div>
    </div>
    <div className="grid-2" style={{ maxWidth: 720, margin: "0 auto" }}>
      {[
        { t: "A name", s: "hidden heritage · stolen identity", tag: "mystery" },
        { t: "A home", s: "displaced · refugee · drifter", tag: "loss" },
        { t: "A person", s: "grief · revenge · unfinished promise", tag: "bond" },
        { t: "A choice", s: "coerced · framed · scapegoated", tag: "injustice" },
        { t: "Nothing yet", s: "you're still whole. for now.", tag: "innocence" },
        { t: "Something else…", s: "tell us in your own words", tag: "freeform" }
      ].map((c,i) => (
        <Box key={i} cls={i === 2 ? "accent" : "dashed"} style={{ cursor: "pointer" }}>
          <div className="w-row">
            <div style={{ flex: 1 }}>
              <div className="w-title" style={{ fontSize: 18, margin: 0 }}>{c.t}</div>
              <div className="w-sub">{c.s}</div>
            </div>
            <Chip accent={i === 2}>{c.tag}</Chip>
          </div>
        </Box>
      ))}
    </div>
    <div className="w-row" style={{ justifyContent: "space-between", marginTop: 20 }}>
      <Btn ghost>← skip question</Btn>
      <div className="w-sub" style={{ color: "var(--ink-dim)" }}>mechanical choices come after the story</div>
      <Btn primary>continue →</Btn>
    </div>
    <Annot style={{ top: 10, right: 16 }}>crunch after story, not before</Annot>
  </Artboard>
);

const WizardScreen = () => (
  <Section id="wizard" title="Character Creation Wizard" sub="linear · single-page · story-led">
    <WizV1_Steps />
    <WizV2_OnePage />
    <WizV3_Guided />
  </Section>
);

Object.assign(window, { WizardScreen });
