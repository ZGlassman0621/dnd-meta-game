// Shared wireframe primitives

const Artboard = ({ title, label, children, wide, minH }) => (
  <div className={"artboard" + (wide ? " wide" : "")}>
    <div className="artboard-head">
      <div className="artboard-title">{title}</div>
      <div className="artboard-label">{label}</div>
    </div>
    <div className="artboard-body" style={{ minHeight: minH || 440 }}>{children}</div>
  </div>
);

const Section = ({ id, title, sub, children }) => (
  <section className="screen active" data-screen-id={id}>
    <div className="section-head">
      <div className="section-title">{title}</div>
      <div className="section-sub">— {sub}</div>
    </div>
    <div className="variations">{children}</div>
  </section>
);

const Box = ({ cls = "", style, children, title, sub }) => (
  <div className={"w-box " + cls} style={style}>
    {title && <div className="w-title">{title}</div>}
    {sub && <div className="w-sub">{sub}</div>}
    {children}
  </div>
);

const Btn = ({ children, primary, ghost, style }) => (
  <span className={"w-btn" + (primary ? " primary" : "") + (ghost ? " ghost" : "")} style={style}>{children}</span>
);

const Chip = ({ children, accent, warn, ok, style }) => (
  <span className={"w-chip" + (accent ? " accent" : "") + (warn ? " warn" : "") + (ok ? " ok" : "")} style={style}>{children}</span>
);

const Ph = ({ w = "full" }) => <span className={"w-ph " + w} />;

const Img = ({ label = "image", style }) => (
  <div className="w-img" style={style}>{label}</div>
);

const Portrait = ({ size = 40, style }) => (
  <div className="w-portrait" style={{ width: size, height: size, ...style }} />
);

const Hr = () => <hr className="w-hr" />;

const Annot = ({ children, style }) => (
  <div className="annot" style={style}>↳ {children}</div>
);

const Stat = ({ label, value, mod }) => (
  <div className="stat">
    <div className="label">{label}</div>
    <div className="value">{value}</div>
    <div className="mod">{mod}</div>
  </div>
);

Object.assign(window, { Artboard, Section, Box, Btn, Chip, Ph, Img, Portrait, Hr, Annot, Stat });
