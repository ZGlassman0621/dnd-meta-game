// Inventory / Merchant shop — 3 variations

const MerchV1_ShopPanel = () => (
  <Artboard title="V1 — Split shop/bag panel" label="classic RPG trade" wide>
    <div className="w-row" style={{ marginBottom: 10, gap: 10 }}>
      <Portrait size={42} />
      <div style={{ flex: 1 }}>
        <div className="w-title" style={{ fontSize: 18, margin: 0 }}>Orin Fairweather</div>
        <div className="w-sub">General goods · Thornveil · disposition: friendly (+4)</div>
      </div>
      <Chip ok>loyal — 5% off</Chip>
      <Chip accent>Gold 1,284</Chip>
    </div>
    <div className="grid-2" style={{ gap: 12 }}>
      <Box title="Orin's wares" sub="restocks every 7 days">
        <div className="w-col" style={{ gap: 4, marginTop: 4 }}>
          {[
            ["Rations (×7)","5 gp","common"],
            ["Healing Potion","42 gp","uncommon"],
            ["Rope, silk (50ft)","8 gp","common"],
            ["Thieves' Tools","22 gp","common"],
            ["Cloak of Billowing","135 gp","uncommon"],
            ["Blade of Whispers*","—","cursed?"]
          ].map((r,i) => (
            <div key={i} className="w-row" style={{ padding: "6px 8px", border: "1px dashed var(--stroke-faint)", borderRadius: 4 }}>
              <div style={{ flex: 1 }}>
                <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{r[0]}</div>
                <div className="w-mono">{r[2]}</div>
              </div>
              <div className="w-mono" style={{ color: r[1]==="—"?"var(--warn)":"var(--accent)" }}>{r[1]}</div>
              <Btn>buy</Btn>
            </div>
          ))}
        </div>
      </Box>
      <Box title="Your bag" sub="34/120 lbs">
        <div className="w-col" style={{ gap: 4, marginTop: 4 }}>
          {[
            ["Pact Blade +1","3 lbs","★"],
            ["Rations (×4)","4 lbs",""],
            ["Potion of Climbing","0.5 lbs",""],
            ["Hex Tome","2 lbs",""]
          ].map((r,i) => (
            <div key={i} className="w-row" style={{ padding: "6px 8px", border: "1px dashed var(--stroke-faint)", borderRadius: 4 }}>
              <div style={{ flex: 1 }}>
                <div className="w-sub" style={{ fontSize: 13, color: "var(--ink)" }}>{r[0]} {r[2]}</div>
                <div className="w-mono">{r[1]}</div>
              </div>
              <Btn ghost>sell</Btn>
            </div>
          ))}
        </div>
      </Box>
    </div>
    <div className="w-row" style={{ marginTop: 10, gap: 8 }}>
      <Btn ghost>haggle · DC 13</Btn>
      <Btn ghost>commission custom…</Btn>
      <div style={{ flex: 1 }} />
      <Chip warn>rumor: he's underpaying</Chip>
    </div>
    <Annot style={{ top: 10, right: 16 }}>cursed items show disguised · flag shown</Annot>
  </Artboard>
);

const MerchV2_Relationship = () => (
  <Artboard title="V2 — Relationship-first shop" label="merchant as character · not a vendor" wide>
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12 }}>
      <div className="w-col">
        <Box cls="accent">
          <div style={{ textAlign: "center" }}>
            <Portrait size={80} style={{ margin: "0 auto" }} />
            <div className="w-title" style={{ fontSize: 18, margin: "6px 0 2px" }}>Orin Fairweather</div>
            <div className="w-sub">halfling · Thornveil</div>
          </div>
          <Hr />
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-mono">disposition</span><Chip ok>+4 friendly</Chip>
          </div>
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-mono">loyalty</span><Chip accent>tier 2 · 5% off</Chip>
          </div>
          <div className="w-row" style={{ justifyContent: "space-between" }}>
            <span className="w-mono">trust</span><Chip>+2</Chip>
          </div>
        </Box>
        <Box title="Conversation" sub="last: 3 days ago">
          <div className="w-sub" style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-dim)" }}>"You brought me that pelt like I asked — I'll not forget it."</div>
        </Box>
        <Box title="Open commissions" sub="2">
          <div className="w-mono">Silvered dagger · ready in 6d</div>
          <div className="w-mono">Antitoxin (×3) · 2d</div>
        </Box>
      </div>
      <div className="w-col">
        <div className="ui-tabs">
          <div className="t active">Wares (12)</div>
          <div className="t">Commission</div>
          <div className="t">Haggle</div>
          <div className="t">Talk</div>
        </div>
        <div className="grid-3" style={{ gap: 6 }}>
          {Array.from({length: 9}).map((_,i) => (
            <Box key={i} cls="dashed" style={{ padding: 8 }}>
              <Img label="icon" style={{ height: 38, marginBottom: 4 }} />
              <div className="w-sub" style={{ fontSize: 12 }}>Item name</div>
              <div className="w-row" style={{ justifyContent: "space-between" }}>
                <span className="w-mono" style={{ color: "var(--accent)" }}>42gp</span>
                <Chip>buy</Chip>
              </div>
            </Box>
          ))}
        </div>
        <Box cls="hollow" style={{ marginTop: 6 }}>
          <div className="w-mono" style={{ color: "var(--ok)" }}>✓ bulk discount at 5+ items → −5%</div>
        </Box>
      </div>
    </div>
    <Annot style={{ top: 10, right: 10 }}>prices modulate on disposition · shown live</Annot>
  </Artboard>
);

const MerchV3_Inline = () => (
  <Artboard title="V3 — Inline shop drawer (from session)" label="doesn't interrupt play" wide>
    <div style={{ padding: 10, border: "1px dashed var(--stroke-faint)", borderRadius: 8 }}>
      <Bubble who="dm">Orin wipes his hands on his apron. "Well? You lookin', or talkin'?"</Bubble>
      <Bubble sys>🏪 MERCHANT — Orin Fairweather opened shop</Bubble>
    </div>
    <Box cls="accent" style={{ marginTop: 10 }}>
      <div className="w-row" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="w-title" style={{ margin: 0, fontSize: 16 }}>Orin's wares · 12 items</div>
          <div className="w-sub">friendly · 5% loyalty discount applied</div>
        </div>
        <Chip>Gold 1,284</Chip>
        <Btn ghost>minimize</Btn>
        <Btn ghost>full view</Btn>
      </div>
      <div className="grid-4" style={{ gap: 6 }}>
        {[
          ["Rations","5gp"],["Healing Potion","42gp"],["Rope","8gp"],["Torches","1gp"],
          ["Cloak of Billowing","135gp"],["Thieves' Tools","22gp"],["Crowbar","2gp"],["Lantern","5gp"]
        ].map(([t,p],i) => (
          <Box key={i} cls="dashed" style={{ padding: 6 }}>
            <div className="w-sub" style={{ fontSize: 12, color: "var(--ink)" }}>{t}</div>
            <div className="w-row" style={{ justifyContent: "space-between", marginTop: 2 }}>
              <span className="w-mono" style={{ color: "var(--accent)" }}>{p}</span>
              <span className="w-mono">+</span>
            </div>
          </Box>
        ))}
      </div>
      <Hr />
      <div className="w-row" style={{ gap: 6 }}>
        <Chip accent>cart: 2 items · 47gp</Chip>
        <div style={{ flex: 1 }} />
        <Btn ghost>haggle</Btn>
        <Btn primary>buy & close</Btn>
      </div>
    </Box>
    <div style={{ marginTop: 10, padding: 10, border: "1px dashed var(--stroke-faint)", borderRadius: 8 }}>
      <Box cls="dashed" style={{ padding: 6 }}>
        <div className="w-row"><div style={{ flex: 1 }}><Ph w="med" /></div><Btn primary>do ↵</Btn></div>
      </Box>
    </div>
    <Annot style={{ top: 6, right: 16 }}>shop appears IN session, not away from it</Annot>
  </Artboard>
);

const MerchantScreen = () => (
  <Section id="merchant" title="Merchant Shop & Inventory" sub="panel · relationship · inline drawer">
    <MerchV1_ShopPanel />
    <MerchV2_Relationship />
    <MerchV3_Inline />
  </Section>
);

Object.assign(window, { MerchantScreen });
