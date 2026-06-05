// NPC Codex / Relationships — 3 variations

const NpcV1_List = () => (
  <Artboard title="V1 — List + detail" label="Spotlight-style filter" wide>
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12 }}>
      <div className="w-col">
        <Box cls="dashed" style={{ padding: 8 }}>
          <div className="w-row">
            <span className="w-mono">⌕</span>
            <span className="w-sub" style={{ marginLeft: 6, color: "var(--ink-dim)" }}>search 47 NPCs…</span>
          </div>
        </Box>
        <div className="w-row" style={{ gap: 4, flexWrap: "wrap" }}>
          <Chip accent>all</Chip><Chip>allies</Chip><Chip>enemies</Chip><Chip>merchants</Chip><Chip warn>missing</Chip><Chip>deceased</Chip>
        </div>
        <Box style={{ padding: 0 }}>
          {[
            {n:"Mirabel Kain",r:"ally",d:"+7 trust · missing 12d"},
            {n:"Orin Fairweather",r:"merchant",d:"+4 friendly"},
            {n:"Lord Varran",r:"enemy",d:"−6 hostile"},
            {n:"Sister Ysa",r:"ally",d:"+5 devoted"},
            {n:"The Grey Wolf",r:"enemy",d:"unknown"},
            {n:"Dorne (companion)",r:"party",d:"loyal"}
          ].map((p,i) => (
            <div key={i} className="w-row" style={{ padding: 8, borderBottom: "1px dashed var(--stroke-faint)", background: i===0 ? "color-mix(in oklab, var(--accent) 10%, transparent)" : "transparent" }}>
              <Portrait size={32} />
              <div style={{ flex: 1, marginLeft: 8 }}>
                <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{p.n}</div>
                <div className="w-mono">{p.d}</div>
              </div>
              <Chip>{p.r}</Chip>
            </div>
          ))}
        </Box>
      </div>
      <div className="w-col">
        <Box cls="accent">
          <div className="w-row" style={{ gap: 10 }}>
            <Portrait size={60} />
            <div style={{ flex: 1 }}>
              <div className="w-title" style={{ fontSize: 20, margin: 0 }}>Mirabel Kain</div>
              <div className="w-sub">human · bard · innkeeper of the Crooked Oak</div>
              <div className="w-row" style={{ gap: 4, marginTop: 4 }}>
                <Chip warn>missing 12 days</Chip>
                <Chip ok>+7 trust</Chip>
                <Chip>last seen: Thornveil</Chip>
              </div>
            </div>
          </div>
        </Box>
        <Box title="Voice" sub="AI-extracted from your sessions">
          <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 16, fontStyle: "italic" }}>"Always tips the chair before sitting. Speaks softly when angry."</div>
        </Box>
        <div className="grid-2" style={{ gap: 10 }}>
          <Box title="Promises / debts">
            <Chip accent>owes Kaelen: a truth</Chip>
            <div className="w-mono" style={{ marginTop: 4 }}>made S7 · unfulfilled</div>
          </Box>
          <Box title="Last conversation" sub="S13">
            <div className="w-sub" style={{ fontSize: 12, fontStyle: "italic" }}>"…if I'm not back by the frost moon, burn the letters in the drawer."</div>
          </Box>
        </div>
        <Box title="Related" sub="3 NPCs">
          <Chip>↳ Orin (cousin)</Chip>
          <Chip style={{ marginLeft: 4 }}>↳ Lord Varran (debt)</Chip>
          <Chip style={{ marginLeft: 4 }}>↳ Dorne (friend)</Chip>
        </Box>
      </div>
    </div>
    <Annot style={{ top: 210, right: 14 }}>voice notes surface the AI's extracted mannerisms</Annot>
  </Artboard>
);

const NpcV2_Graph = () => (
  <Artboard title="V2 — Relationship graph" label="novel · spatial" wide>
    <div style={{ position: "relative", height: 440, border: "1.4px dashed var(--stroke-faint)", borderRadius: 10,
      background: "radial-gradient(circle at center, color-mix(in oklab, var(--accent) 5%, transparent), transparent 60%)" }}>
      {/* Edges */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <line x1="50%" y1="50%" x2="25%" y2="28%" stroke="var(--ok)" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="50%" y1="50%" x2="72%" y2="30%" stroke="var(--warn)" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="50%" y1="50%" x2="28%" y2="72%" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="50%" y1="50%" x2="76%" y2="70%" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="25%" y1="28%" x2="28%" y2="72%" stroke="var(--stroke-faint)" strokeWidth="1.3" strokeDasharray="2 3" />
        <line x1="72%" y1="30%" x2="76%" y2="70%" stroke="var(--stroke-faint)" strokeWidth="1.3" strokeDasharray="2 3" />
      </svg>
      {/* Center = you */}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign:"center" }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", border: "2px solid var(--accent)", background:"var(--bg-2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span className="w-title" style={{ margin: 0, fontSize: 16 }}>you</span>
        </div>
        <div className="w-mono" style={{ marginTop: 4 }}>Kaelen</div>
      </div>
      {[
        {n:"Mira",x:"25%",y:"28%",tag:"ally",c:"ok"},
        {n:"Varran",x:"72%",y:"30%",tag:"enemy",c:"warn"},
        {n:"Orin",x:"28%",y:"72%",tag:"merchant",c:"accent"},
        {n:"Ysa",x:"76%",y:"70%",tag:"ally",c:"accent"}
      ].map((p,i) => (
        <div key={i} style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%,-50%)", textAlign:"center" }}>
          <Portrait size={52} style={{ margin: "0 auto" }} />
          <div className="w-sub" style={{ fontSize: 12 }}>{p.n}</div>
          <Chip accent={p.c==="accent"} ok={p.c==="ok"} warn={p.c==="warn"}>{p.tag}</Chip>
        </div>
      ))}
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
        <Chip>factions</Chip><Chip accent>people</Chip><Chip>locations</Chip>
      </div>
      <div style={{ position: "absolute", bottom: 10, right: 10 }} className="w-mono">zoom to cluster · drag to move</div>
    </div>
    <Annot style={{ top: 20, right: 12 }}>works best for tangled mid/late-game casts</Annot>
  </Artboard>
);

const NpcV3_Cards = () => (
  <Artboard title="V3 — Dossier cards" label="pinterest-style · scanable" wide>
    <div className="w-row" style={{ gap: 6, marginBottom: 10, flexWrap:"wrap" }}>
      <Chip accent>all · 47</Chip><Chip>allies · 12</Chip><Chip>merchants · 8</Chip><Chip warn>missing · 2</Chip><Chip>plot-critical · 6</Chip>
      <div style={{ flex:1 }} />
      <Btn ghost>sort: recent</Btn>
      <Btn ghost>grid · list</Btn>
    </div>
    <div className="grid-3" style={{ gap: 10 }}>
      {[
        {n:"Mirabel Kain", r:"innkeeper · ally", v:"tips chair before sitting", tag:"missing", c:"warn"},
        {n:"Orin Fairweather", r:"merchant · halfling", v:"hums when he's cheating", tag:"friendly", c:"ok"},
        {n:"Lord Varran", r:"noble · enemy", v:"never raises voice", tag:"hostile", c:"warn"},
        {n:"Sister Ysa", r:"cleric · ally", v:"quotes Helm in argument", tag:"devoted", c:"accent"},
        {n:"The Grey Wolf", r:"unknown · rumored", v:"(undiscovered)", tag:"rumor", c:""},
        {n:"Dorne", r:"party · companion", v:"taps mug three times", tag:"loyal", c:"accent"}
      ].map((p,i) => (
        <Box key={i} cls={p.c ? p.c : "dashed"}>
          <div className="w-row" style={{ gap: 8 }}>
            <Portrait size={44} />
            <div style={{ flex: 1 }}>
              <div className="w-title" style={{ margin: 0, fontSize: 15 }}>{p.n}</div>
              <div className="w-mono">{p.r}</div>
            </div>
            <Chip accent={p.c==="accent"} ok={p.c==="ok"} warn={p.c==="warn"}>{p.tag}</Chip>
          </div>
          <Hr />
          <div className="w-sub" style={{ fontStyle: "italic", fontSize: 13 }}>"{p.v}"</div>
          <div className="w-row" style={{ marginTop: 6, gap: 4 }}>
            <Chip>3 convos</Chip><Chip>2 promises</Chip>
          </div>
        </Box>
      ))}
    </div>
    <Annot style={{ top: 16, right: 12 }}>pin the dossiers you're cross-referencing</Annot>
  </Artboard>
);

const NpcScreen = () => (
  <Section id="npc" title="NPC Codex & Relationships" sub="list/detail · graph · dossier cards">
    <NpcV1_List />
    <NpcV2_Graph />
    <NpcV3_Cards />
  </Section>
);

Object.assign(window, { NpcScreen });
