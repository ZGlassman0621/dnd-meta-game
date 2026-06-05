// Print app — renders all winner screens stacked, one per page

const PRINT_SCREENS = [
  { id: "win-session", comp: WinSessionScreen, label: "DM Session (V2)" },
  { id: "win-wizard", comp: WinWizardScreen, label: "Creation Wizard (V1 + V3 teaser)" },
  { id: "win-sheet", comp: WinSheetScreen, label: "Character Sheet (V1)" },
  { id: "win-base", comp: WinBaseScreen, label: "Party Base (V2 × V3)" },
  { id: "win-merchant", comp: WinMerchantScreen, label: "Merchant Shop (V1)" },
  { id: "win-npc", comp: WinNpcScreen, label: "NPC Codex (V1 + V2)" },
  { id: "dash-v2-full", comp: DashV2FullScreen, label: "DM Dashboard (V2)" },
];

function PrintApp() {
  React.useEffect(() => {
    document.documentElement.setAttribute("data-density", "comfortable");
    document.documentElement.setAttribute("data-notes", "off");
  }, []);

  return (
    <>
      <div className="print-cover">
        <div className="print-cover-title">D<b>&amp;</b>D Meta Game</div>
        <div className="print-cover-sub">Wireframe exploration — selected directions</div>
        <div className="print-cover-meta">7 screens · sketch fidelity · desktop 1440w</div>
        <ol className="print-toc">
          {PRINT_SCREENS.map((s, i) => (
            <li key={s.id}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="t">{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
      {PRINT_SCREENS.map((s, i) => {
        const Comp = s.comp;
        return (
          <div key={s.id} className="print-page">
            <div className="print-page-head">
              <span className="w-mono">{String(i + 1).padStart(2, "0")} / {String(PRINT_SCREENS.length).padStart(2, "0")}</span>
              <span className="w-sub">{s.label}</span>
              <span style={{ flex: 1 }}></span>
              <span className="w-mono">D&amp;D Meta Game · wireframes</span>
            </div>
            <div className="print-page-body">
              <Comp />
            </div>
          </div>
        );
      })}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("screens"));
root.render(<PrintApp />);

// Auto-print once fonts & Babel are ready
(async () => {
  try { await document.fonts.ready; } catch (e) {}
  setTimeout(() => {
    // Wait for React to finish mounting
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 600);
    });
  }, 500);
})();
