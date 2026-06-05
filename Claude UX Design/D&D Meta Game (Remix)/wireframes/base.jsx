// Party Base / Fortress management — 3 variations

const BaseV1_Tabs = () => (
  <Artboard title="V1 — Tabbed management" label="mirrors the 6-tab current UI" wide>
    <div className="w-row" style={{ marginBottom: 10 }}>
      <div style={{ flex: 1 }}>
        <div className="w-title" style={{ fontSize: 22, margin: 0 }}>Greypeak Hold</div>
        <div className="w-sub">Martial · Keep · primary · defense 14 · renown 3</div>
      </div>
      <Chip warn>⚠ raid in 4 days</Chip>
      <Chip accent>gold +12/day</Chip>
    </div>
    <div className="ui-tabs">
      {["Overview","Buildings","Garrison","Threats","Staff","Income"].map((t,i)=>(
        <div key={i} className={"t" + (i === 1 ? " active" : "")}>{t}</div>
      ))}
    </div>
    <div className="grid-4" style={{ gap: 10 }}>
      {[
        {t:"Watchtower",s:"+1 def · 14 days",st:"building"},
        {t:"Barracks",s:"+2 garrison",st:"done"},
        {t:"Smithy",s:"+repair",st:"done"},
        {t:"Chapel",s:"+morale",st:"done"},
        {t:"Empty slot",s:"tap to build",st:"empty"},
        {t:"Empty slot",s:"tap to build",st:"empty"},
        {t:"Empty slot",s:"locked at renown 5",st:"locked"},
        {t:"Empty slot",s:"locked",st:"locked"},
      ].map((b,i) => (
        <Box key={i} cls={b.st==="done"?"ok":b.st==="building"?"accent":"dashed"} style={{ minHeight: 84 }}>
          <div className="w-title" style={{ fontSize: 14, margin: 0 }}>{b.t}</div>
          <div className="w-sub" style={{ fontSize: 12 }}>{b.s}</div>
          <div style={{ marginTop: 6 }}>
            {b.st==="building" && <Chip accent>in progress</Chip>}
            {b.st==="done" && <Chip ok>built</Chip>}
            {b.st==="empty" && <Chip>+ build</Chip>}
            {b.st==="locked" && <Chip warn>locked</Chip>}
          </div>
        </Box>
      ))}
    </div>
    <Annot style={{ top: 86, right: 10 }}>threat date needs more weight — move to header</Annot>
  </Artboard>
);

const BaseV2_Map = () => (
  <Artboard title="V2 — Isometric base map" label="novel · the base as a place" wide>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12 }}>
      <div style={{ position: "relative", minHeight: 440, borderRadius: 10, border: "1.4px dashed var(--stroke-faint)", overflow: "hidden",
        background: "repeating-linear-gradient(45deg, color-mix(in oklab, var(--ink-dim) 10%, transparent) 0 10px, transparent 10px 20px)" }}>
        {/* building markers */}
        {[
          {t:"Keep", x: 45, y: 40, s:"done"},
          {t:"Watchtower", x: 20, y: 25, s:"building"},
          {t:"Barracks", x: 68, y: 55, s:"done"},
          {t:"Smithy", x: 32, y: 62, s:"done"},
          {t:"Chapel", x: 58, y: 25, s:"done"},
          {t:"+", x: 75, y: 30, s:"empty"},
          {t:"+", x: 25, y: 75, s:"empty"}
        ].map((b,i) => (
          <div key={i} style={{
            position: "absolute", left: `${b.x}%`, top: `${b.y}%`,
            transform: "translate(-50%, -50%)",
            padding: "8px 12px",
            border: "1.4px " + (b.s==="empty"?"dashed":"solid") + " " + (b.s==="building"?"var(--accent)":b.s==="empty"?"var(--stroke-faint)":"var(--stroke)"),
            background: b.s==="building" ? "color-mix(in oklab, var(--accent) 15%, var(--bg-2))" : "var(--bg-2)",
            borderRadius: 6,
            fontFamily: "var(--hand)", fontSize: 14,
            minWidth: 60, textAlign: "center"
          }}>
            {b.t}
            {b.s==="building" && <div className="w-mono" style={{fontSize:9}}>14d</div>}
          </div>
        ))}
        {/* threat indicator */}
        <div style={{ position: "absolute", right: 14, top: 14, padding: "6px 10px", background: "color-mix(in oklab, var(--warn) 20%, var(--bg-2))", border: "1.4px dashed var(--warn)", borderRadius: 6 }}>
          <div className="w-mono" style={{ color: "var(--warn)" }}>⚠ RAID → 4 DAYS</div>
          <div className="w-sub" style={{ fontSize: 12, color: "var(--warn)" }}>Scarred Wolves · 18 raiders</div>
        </div>
      </div>
      <div className="w-col">
        <Box cls="accent" title="Greypeak Hold">
          <div className="w-row" style={{ gap: 6, flexWrap: "wrap" }}>
            <Chip accent>Keep</Chip><Chip>def 14</Chip><Chip ok>renown 3</Chip>
          </div>
        </Box>
        <Box title="Garrison" sub="4 / 8 slots">
          <div className="w-col" style={{ gap: 4 }}>
            {["Dorne (Captain)","Mira (Scout)","+ assign", "+ assign"].map((x,i)=>(
              <div key={i} className="w-mono" style={{ padding: 4, border: "1px dashed var(--stroke-faint)", borderRadius: 4 }}>{x}</div>
            ))}
          </div>
        </Box>
        <Box title="Daily ledger">
          <div className="w-mono">income: +22 gp</div>
          <div className="w-mono">upkeep: −10 gp</div>
          <div className="w-mono" style={{ color: "var(--accent)" }}>net +12 gp</div>
        </Box>
      </div>
    </div>
    <Annot style={{ top: 20, right: 270 }}>click any tile → build/demo dialog</Annot>
  </Artboard>
);

const BaseV3_Ledger = () => (
  <Artboard title="V3 — Ops dashboard" label="for system-minded DMs" wide>
    <div className="w-row" style={{ marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
      <Box cls="hollow" style={{ flex: 1, padding: 10 }}>
        <div className="w-mono">BASE</div>
        <div className="w-title" style={{ fontSize: 18, margin: 0 }}>Greypeak Hold</div>
      </Box>
      <Box style={{ padding: 10, minWidth: 120 }}>
        <div className="w-mono">DEFENSE</div>
        <div className="w-title" style={{ fontSize: 24, margin: 0 }}>14</div>
      </Box>
      <Box style={{ padding: 10, minWidth: 120 }}>
        <div className="w-mono">GARRISON</div>
        <div className="w-title" style={{ fontSize: 24, margin: 0 }}>4/8</div>
      </Box>
      <Box style={{ padding: 10, minWidth: 120 }}>
        <div className="w-mono">TREASURY</div>
        <div className="w-title" style={{ fontSize: 24, margin: 0 }}>1,284gp</div>
      </Box>
      <Box cls="warn" style={{ padding: 10, minWidth: 120 }}>
        <div className="w-mono" style={{ color: "var(--warn)" }}>RAID IN</div>
        <div className="w-title" style={{ fontSize: 24, margin: 0, color: "var(--warn)" }}>4d</div>
      </Box>
    </div>
    <div className="grid-2" style={{ gap: 10 }}>
      <Box title="Buildings — status" sub="4 done · 1 building · 3 empty">
        <div className="w-col" style={{ gap: 4 }}>
          {[
            {t:"Keep",s:"done",p:100},
            {t:"Barracks",s:"done",p:100},
            {t:"Smithy",s:"done",p:100},
            {t:"Chapel",s:"done",p:100},
            {t:"Watchtower",s:"building",p:40},
            {t:"Empty",s:"empty",p:0},
            {t:"Empty",s:"empty",p:0}
          ].map((b,i) => (
            <div key={i} className="w-row" style={{ gap: 8 }}>
              <div style={{ width: 90 }} className="w-sub">{b.t}</div>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--stroke-faint)", overflow: "hidden" }}>
                <div style={{ width: b.p + "%", height: "100%", background: b.s==="done"?"var(--ok)":b.s==="building"?"var(--accent)":"transparent" }}></div>
              </div>
              <Chip ok={b.s==="done"} accent={b.s==="building"}>{b.s}</Chip>
            </div>
          ))}
        </div>
      </Box>
      <Box title="Upcoming events">
        <div className="w-col" style={{ gap: 6 }}>
          <div className="w-row"><Chip warn>−4d</Chip><span className="w-sub">Scarred Wolves raid (18 raiders)</span></div>
          <div className="w-row"><Chip accent>−14d</Chip><span className="w-sub">Watchtower complete</span></div>
          <div className="w-row"><Chip>−30d</Chip><span className="w-sub">Tax collection · renown check</span></div>
          <div className="w-row"><Chip>−45d</Chip><span className="w-sub">Merchant caravan · Iron Guild</span></div>
        </div>
      </Box>
    </div>
    <Annot style={{ top: 24, right: 12 }}>if you love spreadsheets: this is for you</Annot>
  </Artboard>
);

const BaseScreen = () => (
  <Section id="base" title="Party Base · Fortress" sub="tabs · isometric map · ops dashboard">
    <BaseV1_Tabs />
    <BaseV2_Map />
    <BaseV3_Ledger />
  </Section>
);

Object.assign(window, { BaseScreen });
