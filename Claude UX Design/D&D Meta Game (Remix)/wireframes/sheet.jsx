// Character Sheet — 3 variations

const SheetV1_Classic = () => (
  <Artboard title="V1 — Tabbed classic" label="honors the paper sheet" wide>
    <div className="w-row" style={{ gap: 14, marginBottom: 10 }}>
      <Portrait size={60} />
      <div style={{ flex: 1 }}>
        <div className="w-title" style={{ fontSize: 22, margin: 0 }}>Kaelen Voss</div>
        <div className="w-sub">Tiefling · Warlock (Hexblade) 7 · Noble</div>
      </div>
      <Chip accent>HP 42/52</Chip>
      <Chip>AC 15</Chip>
      <Chip>Init +2</Chip>
      <Chip>Spd 30</Chip>
    </div>
    <div className="ui-tabs">
      {["Stats","Combat","Spells","Inventory","Features","Background","Progression","Mythic"].map((t,i) => (
        <div key={i} className={"t" + (i === 0 ? " active" : "")}>{t}</div>
      ))}
    </div>
    <div className="grid-3" style={{ gap: 10 }}>
      <Box title="Abilities">
        <div className="grid-3" style={{ gap: 6 }}>
          <Stat label="STR" value="10" mod="+0" />
          <Stat label="DEX" value="14" mod="+2" />
          <Stat label="CON" value="14" mod="+2" />
          <Stat label="INT" value="11" mod="+0" />
          <Stat label="WIS" value="12" mod="+1" />
          <Stat label="CHA" value="18" mod="+4" />
        </div>
      </Box>
      <Box title="Saves & skills">
        <div className="w-col" style={{ gap: 3 }}>
          {["CHA ●+6","WIS ●+3","Persuasion ●+6","Arcana +0","Deception ●+6","Stealth +2"].map((x,i)=>(
            <div key={i} className="w-mono">{x}</div>
          ))}
        </div>
      </Box>
      <Box title="Combat">
        <div className="w-mono">Prof +3</div>
        <div className="w-mono">Spell DC 14 · Atk +6</div>
        <Hr />
        <Chip accent>Eldritch Blast +6 · 1d10</Chip>
        <Chip style={{ marginLeft: 4 }}>Pact Blade +6 · 1d8+4</Chip>
      </Box>
    </div>
    <Annot style={{ top: 130, right: 16 }}>8 tabs = a lot. use it IF chronically scanning.</Annot>
  </Artboard>
);

const SheetV2_Modular = () => (
  <Artboard title="V2 — Dashboard tiles" label="favorites-up-top · rearrangeable" wide>
    <div className="w-row" style={{ gap: 12, marginBottom: 10 }}>
      <Portrait size={54} />
      <div style={{ flex: 1 }}>
        <div className="w-title" style={{ fontSize: 20, margin: 0 }}>Kaelen Voss</div>
        <div className="w-sub">Warlock 7 · Hexblade · Crowned Shadow</div>
      </div>
      <Btn ghost>⚙ customize tiles</Btn>
      <Btn>level up ↑</Btn>
    </div>
    <div className="grid-4" style={{ gap: 10 }}>
      <Box cls="accent" title="Vitals">
        <div className="w-title" style={{ fontSize: 30, margin: 0 }}>42<span style={{ fontSize: 14, color:"var(--ink-dim)" }}> / 52</span></div>
        <div className="w-mono">AC 15 · HD 3/7</div>
      </Box>
      <Box title="Spell slots">
        <div className="w-row" style={{ gap: 4 }}>
          {[1,2,0].map((v,i)=>(
            <div key={i} style={{ flex: 1, border:"1.3px dashed var(--stroke-faint)", borderRadius: 4, padding: 4, textAlign:"center" }}>
              <div className="w-mono">L{i+3}</div>
              <div className="w-title" style={{ fontSize: 18 }}>{v}/2</div>
            </div>
          ))}
        </div>
      </Box>
      <Box title="Mythic" sub="tier II · Redemption">
        <div className="w-row"><Chip accent>Power 4/7</Chip></div>
        <div className="w-mono" style={{ marginTop: 4 }}>piety: Helm 22 · Bahamut 8</div>
      </Box>
      <Box title="Conditions">
        <Chip warn>poisoned · 1hr</Chip><br/>
        <Chip>concentrating: Hex</Chip>
      </Box>
      <Box title="Abilities" style={{ gridColumn: "span 2" }}>
        <div className="grid-3" style={{ gap: 6 }}>
          {[["STR","10","+0"],["DEX","14","+2"],["CON","14","+2"],["INT","11","+0"],["WIS","12","+1"],["CHA","18","+4"]].map(([l,v,m],i) => (
            <Stat key={i} label={l} value={v} mod={m} />
          ))}
        </div>
      </Box>
      <Box title="Favorite spells" style={{ gridColumn: "span 2" }}>
        <div className="w-row" style={{ flexWrap: "wrap", gap: 4 }}>
          <Chip accent>Eldritch Blast</Chip>
          <Chip>Hex</Chip>
          <Chip>Shield</Chip>
          <Chip>Counterspell</Chip>
          <Chip ghost>+ pin more…</Chip>
        </div>
      </Box>
      <Box title="Inventory" style={{ gridColumn: "span 2" }}>
        <div className="w-mono">carried by party leader · 34/120 lbs</div>
        <Chip accent>Pact Blade +1</Chip>
        <Chip style={{ marginLeft: 4 }}>Hexblade's Curse Tome</Chip>
        <Chip style={{ marginLeft: 4 }}>Rations × 4</Chip>
      </Box>
      <Box title="Progression" style={{ gridColumn: "span 2" }}>
        <div className="w-sub">themes: Knight · Scholar</div>
        <div className="w-mono">next tier at lvl 11</div>
        <Chip warn>ancestry feat pending at 7</Chip>
      </Box>
    </div>
    <Annot style={{ top: 20, right: 8 }}>drag tiles to reorder. hide the ones you don't need.</Annot>
  </Artboard>
);

const SheetV3_Spellbook = () => (
  <Artboard title="V3 — Spellbook layout" label="novel · in-world object" wide>
    <div style={{ background: "color-mix(in oklab, var(--panel) 50%, transparent)", border: "1.4px solid var(--stroke-faint)", borderRadius: 8, padding: 18, minHeight: 480 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4px 1fr", gap: 24, minHeight: 440 }}>
        <div>
          <div className="w-mono" style={{ textAlign: "right", color: "var(--ink-faint)" }}>folio I · recto</div>
          <div className="w-title" style={{ fontSize: 26, fontFamily: "var(--note)" }}>Kaelen Voss</div>
          <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 18 }}>of the bound blade · tiefling of house Voss</div>
          <Hr />
          <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 16, lineHeight: 1.5 }}>
            Strength, a ten. Dexterity, fourteen. Constitution, fourteen. Intellect, eleven. Wisdom, twelve. Charisma, <i>eighteen</i> (the gift of the pact).
          </div>
          <Hr />
          <div className="w-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Chip>AC 15</Chip><Chip accent>HP 42/52</Chip><Chip>Init +2</Chip><Chip>Spd 30</Chip>
          </div>
          <Hr />
          <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 15 }}>Proficiencies: light armor, medium armor, shields. Simple & martial weapons. Persuasion, Deception, Arcana, History.</div>
        </div>
        <div style={{ background: "var(--stroke-faint)" }} />
        <div>
          <div className="w-mono" style={{ color: "var(--ink-faint)" }}>folio I · verso</div>
          <div className="w-title" style={{ fontSize: 18, fontFamily: "var(--note)" }}>Invocations & Pact Gifts</div>
          <div className="w-col" style={{ gap: 6, marginTop: 6 }}>
            <Box cls="dashed" style={{ padding: 8 }}>
              <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 16 }}>★ Agonizing Blast</div>
              <div className="w-mono">adds CHA to blast damage</div>
            </Box>
            <Box cls="dashed" style={{ padding: 8 }}>
              <div className="w-sub" style={{ fontFamily: "var(--note)", fontSize: 16 }}>★ Devil's Sight</div>
              <div className="w-mono">see 120 ft in magical darkness</div>
            </Box>
          </div>
          <Hr />
          <div className="w-title" style={{ fontSize: 18, fontFamily: "var(--note)" }}>Spells prepared</div>
          <div className="w-row" style={{ gap: 4, flexWrap: "wrap" }}>
            <Chip accent>Eldritch Blast</Chip>
            <Chip>Hex</Chip>
            <Chip>Shield</Chip>
            <Chip>Counterspell</Chip>
            <Chip>Mislead</Chip>
          </div>
        </div>
      </div>
      <div className="w-row" style={{ justifyContent: "center", marginTop: 12, gap: 12 }}>
        <Btn ghost>← folio</Btn>
        <span className="w-mono">I · II · III · IV</span>
        <Btn ghost>folio →</Btn>
      </div>
    </div>
    <Annot style={{ top: 10, right: 10 }}>theming for theming's sake? OR lovely?</Annot>
  </Artboard>
);

const SheetScreen = () => (
  <Section id="sheet" title="Character Sheet" sub="dense data · three organizing metaphors">
    <SheetV1_Classic />
    <SheetV2_Modular />
    <SheetV3_Spellbook />
  </Section>
);

Object.assign(window, { SheetScreen });
