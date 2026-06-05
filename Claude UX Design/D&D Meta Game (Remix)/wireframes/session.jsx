// DM Session (Player Mode) — 4 variations exploring chat-first vs. tool-first

const Bubble = ({ who, children, sys }) => (
  <div style={{ display: "flex", flexDirection: who === "you" ? "row-reverse" : "row", marginBottom: 8 }}>
    <div className={"bubble " + (sys ? "system" : who)}>
      {!sys && who === "dm" && <div className="w-mono" style={{ marginBottom: 2 }}>DM</div>}
      {children}
    </div>
  </div>
);

const SessionV1_ChatFirst = () => (
  <Artboard title="V1 — Chat-first (minimalist)" label="one column · tools as drawers" wide>
    <div style={{ display: "flex", gap: 12, height: 540 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="w-row" style={{ marginBottom: 10 }}>
          <Chip accent>Crowned Shadow</Chip>
          <Chip>S15 · Thornveil</Chip>
          <Chip>HP 42/52</Chip>
          <div style={{ flex: 1 }} />
          <Btn ghost>⚔ combat</Btn>
          <Btn ghost>🎒 bag</Btn>
          <Btn ghost>📖 refs</Btn>
          <Btn ghost>⌘K</Btn>
        </div>
        <div style={{ flex: 1, overflow: "hidden", padding: 6, border: "1px dashed var(--stroke-faint)", borderRadius: 8, display: "flex", flexDirection: "column" }}>
          <Bubble sys>⛰ You enter Thornveil Gate — the iron doors have been pried open from inside.</Bubble>
          <Bubble who="dm">The snow has turned to slush under boots that passed before yours. <br/>A torch sputters in the gatehouse — no guard in sight.</Bubble>
          <Bubble who="you">I draw my blade and signal Mira to hang back. Perception check?</Bubble>
          <Bubble sys>🎲 Perception (WIS) → 17</Bubble>
          <Bubble who="dm">You catch the faintest whisper — two voices, arguing, from the eastern passage…</Bubble>
        </div>
        <Box cls="dashed" style={{ marginTop: 10, padding: 10 }}>
          <div className="w-row" style={{ gap: 6 }}>
            <div style={{ flex: 1 }}><Ph w="med" /></div>
            <Btn>Say</Btn>
            <Btn primary>Do ↵</Btn>
          </div>
          <div className="w-row" style={{ gap: 6, marginTop: 6 }}>
            <Chip>/roll 1d20+4</Chip>
            <Chip>/ooc</Chip>
            <Chip>/rest</Chip>
          </div>
        </Box>
      </div>
      <div style={{ width: 72, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {["⚔","🎒","📖","🗺","👥","⚡"].map((i, k) => (
          <div key={k} style={{ width: 56, height: 56, borderRadius: 10, border: "1.4px dashed var(--stroke-faint)", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 20 }}>{i}</div>
        ))}
      </div>
    </div>
    <Annot style={{ top: 70, right: 90 }}>tools hidden until called — fewest distractions during roleplay</Annot>
  </Artboard>
);

const SessionV2_ToolFirst = () => (
  <Artboard title="V2 — Tool-first (dashboard)" label="everything visible · reference-heavy" wide>
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 220px", gap: 10, height: 540 }}>
      <div className="w-col">
        <Box title="Party" sub="">
          {["Kaelen","Mira","Dorne"].map((n, i) => (
            <div key={i} className="w-row" style={{ gap: 6, marginTop: 6 }}>
              <Portrait size={28} />
              <div style={{ flex: 1 }}>
                <div className="w-sub" style={{ fontSize: 12 }}>{n}</div>
                <div className="w-mono">HP 42/52</div>
              </div>
            </div>
          ))}
        </Box>
        <Box title="Conditions" sub="">
          <Chip warn>poisoned</Chip>
          <Chip style={{ marginLeft: 4 }}>concentrating</Chip>
        </Box>
        <Box title="Effects">
          <div className="w-mono">Bless · 3 rds</div>
          <div className="w-mono">Bane · 2 rds</div>
        </Box>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="w-row" style={{ marginBottom: 8 }}>
          <Chip accent>S15 · Thornveil</Chip>
          <Chip>round 3 · init 18</Chip>
          <div style={{ flex: 1 }} />
          <Btn ghost>pause</Btn>
        </div>
        <div style={{ flex: 1, padding: 8, border: "1px dashed var(--stroke-faint)", borderRadius: 8, overflow: "hidden" }}>
          <Bubble who="dm">The cultist raises a twisted rod — shadow curls along it.</Bubble>
          <Bubble sys>⚔ COMBAT — Cultist rolled initiative 14</Bubble>
          <Bubble who="you">Hit him with Eldritch Blast before he finishes casting!</Bubble>
          <Bubble sys>🎲 Attack → 19 vs AC 13 · hit · 1d10+4 = 11 force dmg</Bubble>
        </div>
        <Box cls="dashed" style={{ marginTop: 8, padding: 8 }}>
          <div className="w-row"><div style={{ flex: 1 }}><Ph w="med" /></div><Btn primary>Act ↵</Btn></div>
        </Box>
      </div>
      <div className="w-col">
        <Box title="Initiative">
          {["Mira 22","You 18 ▸","Cultist 14","Dorne 11"].map((x,i) => (
            <div key={i} className="w-mono" style={{ padding: 4, background: i===1 ? "color-mix(in oklab, var(--accent) 15%, transparent)":"transparent", borderRadius: 4 }}>{x}</div>
          ))}
        </Box>
        <Box title="Spells" sub="2/3 · 4/3">
          <Chip accent>Eldritch Blast</Chip>
          <Chip style={{ marginLeft: 4 }}>Hex</Chip>
          <Chip style={{ marginLeft: 4 }}>Shield</Chip>
        </Box>
        <Box title="Rules" sub="cover · opp. attack">
          <div className="w-mono">½ cover → +2 AC</div>
          <div className="w-mono">¾ cover → +5 AC</div>
        </Box>
      </div>
    </div>
    <Annot style={{ top: 16, right: 10 }}>for players who like a cockpit</Annot>
  </Artboard>
);

const SessionV3_Split = () => (
  <Artboard title="V3 — Narrative + Live Sheet split" label="best of both · context on the right" wide>
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, height: 540 }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="w-row" style={{ marginBottom: 8 }}>
          <Chip accent>Crowned Shadow · S15</Chip>
          <Chip>Thornveil Gate</Chip>
          <div style={{ flex: 1 }} />
          <Btn ghost>⌘ cmd</Btn>
        </div>
        <div style={{ flex: 1, padding: 10, border: "1px dashed var(--stroke-faint)", borderRadius: 8, overflow: "hidden" }}>
          <Bubble who="dm">The snow has turned to slush under boots that passed before yours.</Bubble>
          <Bubble who="you">I signal Mira to hang back. Perception.</Bubble>
          <Bubble sys>🎲 17 · WIS · you hear two voices arguing</Bubble>
          <Bubble who="dm">“…he'll find out eventually…” — the other hisses back: “not tonight.”</Bubble>
        </div>
        <Box cls="dashed" style={{ marginTop: 8, padding: 10 }}>
          <div className="w-row"><div style={{ flex: 1 }}><Ph w="full" /></div><Btn>say</Btn><Btn primary>do ↵</Btn></div>
        </Box>
      </div>
      <div className="w-col">
        <Box title="Kaelen · Lvl 7 Warlock">
          <div className="grid-3" style={{ gap: 6 }}>
            <Stat label="STR" value="10" mod="+0" />
            <Stat label="DEX" value="14" mod="+2" />
            <Stat label="CON" value="14" mod="+2" />
            <Stat label="INT" value="11" mod="+0" />
            <Stat label="WIS" value="12" mod="+1" />
            <Stat label="CHA" value="18" mod="+4" />
          </div>
          <div className="w-row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
            <Chip accent>HP 42/52</Chip>
            <Chip>AC 15</Chip>
            <Chip>Slots 2/3</Chip>
          </div>
        </Box>
        <Box title="Quick actions">
          <div className="grid-2" style={{ gap: 6 }}>
            <Btn>Perception</Btn>
            <Btn>Stealth</Btn>
            <Btn>Persuasion</Btn>
            <Btn>Initiative</Btn>
          </div>
        </Box>
        <Box title="Location" sub="Thornveil Gate">
          <Img label="map fragment" style={{ height: 88 }} />
        </Box>
      </div>
    </div>
    <Annot style={{ top: 70, right: 6 }}>sheet updates live as events fire</Annot>
  </Artboard>
);

const SessionV4_Map = () => (
  <Artboard title="V4 — Map-anchored (novel)" label="place-first · narrative underneath" wide>
    <div style={{ display: "grid", gridTemplateRows: "55% 45%", gap: 10, height: 540 }}>
      <div style={{ position: "relative", borderRadius: 8, border: "1.4px dashed var(--stroke-faint)", overflow: "hidden" }}>
        <Img label="region map · thornveil" style={{ position: "absolute", inset: 0, border: "none", borderRadius: 0 }} />
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6 }}>
          <Chip accent>◉ You</Chip><Chip>Mira</Chip><Chip warn>⚠ cultists?</Chip>
        </div>
        <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 6 }}>
          <Btn ghost>zoom +</Btn><Btn ghost>world</Btn>
        </div>
        <div style={{ position: "absolute", top: "45%", left: "38%", width: 14, height: 14, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 0 4px color-mix(in oklab, var(--accent) 30%, transparent)" }}></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 10 }}>
        <div style={{ border: "1px dashed var(--stroke-faint)", borderRadius: 8, padding: 10, overflow: "hidden" }}>
          <Bubble who="dm">The snow has turned to slush. Two voices whisper from the east passage.</Bubble>
          <Bubble who="you">Sneak closer — Stealth!</Bubble>
          <Bubble sys>🎲 Stealth → 21</Bubble>
          <Box cls="dashed" style={{ marginTop: 6, padding: 6 }}>
            <div className="w-row"><div style={{ flex: 1 }}><Ph w="med" /></div><Btn primary>↵</Btn></div>
          </Box>
        </div>
        <div className="w-col">
          <Box title="Thornveil Gate" sub="">
            <div className="w-mono">weather: snow · dusk</div>
            <div className="w-mono">tension: high</div>
            <Chip accent>3 NPCs nearby</Chip>
          </Box>
          <Box title="Kaelen"><Chip>HP 42/52</Chip><Chip style={{ marginLeft:4 }}>AC 15</Chip></Box>
        </div>
      </div>
    </div>
    <Annot style={{ top: 14, right: 260 }}>map is never "a tab" — it's the session itself</Annot>
  </Artboard>
);

const SessionScreen = () => (
  <Section id="session" title="DM Session · Player Mode" sub="chat-first vs. tool-first · information hierarchy">
    <SessionV1_ChatFirst />
    <SessionV2_ToolFirst />
    <SessionV3_Split />
    <SessionV4_Map />
  </Section>
);

Object.assign(window, { SessionScreen });
