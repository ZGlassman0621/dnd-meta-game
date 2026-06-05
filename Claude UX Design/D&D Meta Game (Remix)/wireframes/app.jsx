// App — mounts screens, wires tabs, wires Tweaks panel

const { useState, useEffect } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "semidark",
  "density": "comfortable",
  "notes": true
}/*EDITMODE-END*/;

const SCREENS = [
  { id: "dashboard", comp: Dashboard, label: "Dashboard" },
  { id: "session", comp: SessionScreen, label: "DM Session" },
  { id: "wizard", comp: WizardScreen, label: "Creation Wizard" },
  { id: "sheet", comp: SheetScreen, label: "Character Sheet" },
  { id: "base", comp: BaseScreen, label: "Party Base" },
  { id: "merchant", comp: MerchantScreen, label: "Merchant Shop" },
  { id: "npc", comp: NpcScreen, label: "NPC Codex" },
  { id: "dash-v2-full", comp: DashV2FullScreen, label: "★ Dashboard V2 Full" },
  { id: "win-session", comp: WinSessionScreen, label: "★ Session (V2)" },
  { id: "win-wizard", comp: WinWizardScreen, label: "★ Wizard (V1+V3)" },
  { id: "win-sheet", comp: WinSheetScreen, label: "★ Sheet (V1)" },
  { id: "win-base", comp: WinBaseScreen, label: "★ Base (V2×V3)" },
  { id: "win-merchant", comp: WinMerchantScreen, label: "★ Merchant (V1)" },
  { id: "win-npc", comp: WinNpcScreen, label: "★ NPC (V1+V2)" },
];

function App() {
  const [active, setActive] = useState("dashboard");
  const [tweaks, setTweak] = useTweaks(DEFAULTS);

  // Apply theme + density + notes to root
  useEffect(() => {
    const t = tweaks.theme || "semidark";
    if (t === "semidark") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    document.documentElement.setAttribute("data-density", tweaks.density || "comfortable");
    document.documentElement.setAttribute("data-notes", tweaks.notes ? "on" : "off");
  }, [tweaks]);

  // Wire top tabs
  useEffect(() => {
    const tabs = document.querySelectorAll("#tabs .tab");
    tabs.forEach(t => {
      t.classList.toggle("active", t.dataset.screen === active);
      t.onclick = () => setActive(t.dataset.screen);
    });
    const idx = SCREENS.findIndex(s => s.id === active);
    const hint = document.getElementById("screenHint");
    if (hint) hint.textContent = `${idx + 1} / ${SCREENS.length} · ${SCREENS[idx].label}`;
  }, [active]);

  return (
    <>
      {SCREENS.map(s => {
        const Comp = s.comp;
        return (
          <div key={s.id} style={{ display: s.id === active ? "block" : "none" }}>
            <Comp />
          </div>
        );
      })}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Mode" value={tweaks.theme} options={[
          { value: "semidark", label: "Semi-dark" },
          { value: "midnight", label: "Midnight" },
          { value: "parchment", label: "Parchment" },
          { value: "light", label: "Light" },
        ]} onChange={v => setTweak("theme", v)} />
        <TweakSection label="Density" />
        <TweakRadio label="Size" value={tweaks.density} options={[
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Regular" },
          { value: "spacious", label: "Spacious" },
        ]} onChange={v => setTweak("density", v)} />
        <TweakSection label="Annotations" />
        <TweakToggle label="Red notes" value={tweaks.notes} onChange={v => setTweak("notes", v)} />
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("screens"));
root.render(<App />);
