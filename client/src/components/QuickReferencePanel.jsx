import { Fragment } from 'react';
import classesData from '../data/classes.json';
import racesData from '../data/races.json';

// Local inline sprite — symbol paths copied from the cockpit design's <defs>.
// Kept local so we never touch the shared HearthSprite.
function QRSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="qr-scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
          <path d="M19 17V5a2 2 0 0 0-2-2H4" />
        </symbol>
        <symbol id="qr-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </symbol>
        <symbol id="qr-arrow-ur" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7M7 7h10v10" />
        </symbol>
      </defs>
    </svg>
  );
}

const parseJson = (v, dflt) => {
  if (v == null) return dflt;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return dflt; }
};

const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
const ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
// Save proficiency keys → which ability score they use
const SKILL_ABILITY = {
  acrobatics: 'dex', 'animal handling': 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', 'sleight of hand': 'dex',
  stealth: 'dex', survival: 'wis'
};

function QuickReferencePanel({ character, onClose, spellSlots }) {
  const level = character?.level || 1;
  const classKey = character?.class?.toLowerCase();
  const classData = classesData[classKey];
  const isMonk = classKey === 'monk';
  const shortName = character?.nickname || character?.name?.split(' ')[0] || character?.name || 'You';
  const speed = character?.speed || 30;
  const profBonus = Math.ceil(level / 4) + 1;

  // ability scores (JSON column, or separate columns as fallback)
  const abil = parseJson(character?.ability_scores, null) || {
    str: character?.strength, dex: character?.dexterity, con: character?.constitution,
    int: character?.intelligence, wis: character?.wisdom, cha: character?.charisma
  };
  const abilMod = (k) => Math.floor((((abil?.[k]) ?? 10) - 10) / 2);

  const hitDie = classData?.hitDie || 8;
  const conMod = abilMod('con');
  const computedMaxHp = Math.max(1, hitDie + conMod + Math.max(0, level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
  const maxHp = character?.max_hp > 0 ? character.max_hp : computedMaxHp;
  const curHp = character?.current_hp > 0 ? character.current_hp : maxHp;
  const ac = (() => {
    if (isMonk) return 10 + abilMod('dex') + abilMod('wis');
    if (classKey === 'barbarian') return 10 + abilMod('dex') + abilMod('con');
    return (character?.armor_class && character.armor_class > 0) ? character.armor_class : 10 + abilMod('dex');
  })();
  const init = abilMod('dex');
  // Monk ki points equal monk level (no per-session "used" value is tracked).
  const kiMax = isMonk ? level : 0;

  // ── Saves & key skills ──────────────────────────────────────────────
  const saveKeys = Array.isArray(classData?.savingThrows) ? classData.savingThrows : [];
  const saves = saveKeys
    .filter((k) => ABBR[k])
    .map((k) => ({ label: `${ABBR[k]} save`, value: `${sign(abilMod(k) + profBonus)} · proficient` }));

  const skillList = parseJson(character?.skills, []) || [];
  const skills = skillList
    .map((s) => {
      const raw = (typeof s === 'string' ? s : s?.name) || '';
      const key = raw.toLowerCase().replace(/_/g, ' ').trim();
      const ability = SKILL_ABILITY[key];
      if (!ability) return null;
      const nice = key.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { label: nice, value: `${sign(abilMod(ability) + profBonus)} · proficient` };
    })
    .filter(Boolean);
  const isPerceptionProf = skillList.some((s) => {
    const raw = (typeof s === 'string' ? s : s?.name) || '';
    return raw.toLowerCase().replace(/_/g, ' ').trim() === 'perception';
  });

  // Senses: passive perception is always derivable; darkvision comes from race traits.
  const passivePerc = 10 + abilMod('wis') + (isPerceptionProf ? profBonus : 0);
  const raceInfo = racesData[character?.race?.toLowerCase()];
  let raceTraits = raceInfo?.traits || [];
  if (character?.subrace && raceInfo?.subraces) {
    const sr = raceInfo.subraces.find((x) => x.name?.toLowerCase() === character.subrace?.toLowerCase());
    if (sr?.traits) raceTraits = sr.traits;
  }
  const darkvision = raceTraits.find((t) => String(t).trim().toLowerCase().startsWith('darkvision'));
  const senses = [darkvision ? String(darkvision).split(' - ')[0].trim() : null, `Passive Perc. ${passivePerc}`]
    .filter(Boolean).join(' · ');

  // ── Class features / Ki techniques ──────────────────────────────────
  const features = (() => {
    const out = [];
    if (Array.isArray(classData?.features)) classData.features.forEach((f) => {
      const s = String(f); const d = s.indexOf(' - ');
      out.push({ name: d > 0 ? s.slice(0, d).trim() : s.trim(), desc: d > 0 ? s.slice(d + 3).trim() : '' });
    });
    const sub = classData?.subclasses?.find((sc) => sc.name === character?.subclass);
    if (sub?.featuresByLevel) Object.entries(sub.featuresByLevel)
      .filter(([l]) => parseInt(l) <= level)
      .forEach(([, fs]) => (fs || []).forEach((f) => out.push({ name: f.name || String(f), desc: f.description || '' })));
    return out.slice(0, 8);
  })();

  // ── Actions in a pinch (universal 5e action rules, not character data) ─
  const pinchActions = [
    { label: 'Dodge', value: 'attacks vs you have disadvantage' },
    { label: 'Disengage', value: 'move without provoking opportunity attacks' },
    { label: 'Dash', value: 'gain extra movement equal to your speed' },
    { label: 'Help', value: 'give an ally advantage on their next check or attack' }
  ];

  return (
    <>
      <QRSprite />
      <div className="panel-scrim show" onClick={onClose} />
      <aside className="pnl open" data-panel="quickref">
        <div className="pnl-head">
          <svg className="ph-ic2"><use href="#qr-scroll" /></svg>
          <h3>Quick reference</h3>
          <span className="ph-sub2">{shortName} · L{level} {character?.class || ''}</span>
          <button className="pnl-close" onClick={onClose} aria-label="Close">
            <svg className="ic"><use href="#qr-x" /></svg>
          </button>
        </div>

        <div className="pnl-body scroll">
          <div className="pnl-sec">Vitals<span className="ln"></span></div>
          <div className="qr-stats">
            <div className="qr-stat hp"><div className="l">HP</div><div className="v">{curHp}<span className="mx">/{maxHp}</span></div></div>
            <div className="qr-stat"><div className="l">AC</div><div className="v">{ac}</div></div>
            <div className="qr-stat"><div className="l">Speed</div><div className="v">{speed}</div></div>
            <div className="qr-stat"><div className="l">Init</div><div className="v">{sign(init)}</div></div>
            <div className="qr-stat"><div className="l">Prof</div><div className="v">{sign(profBonus)}</div></div>
            {isMonk && (
              <div className="qr-stat"><div className="l">Ki</div><div className="v">{kiMax}</div></div>
            )}
          </div>

          {(saves.length > 0 || skills.length > 0 || senses) && (
            <>
              <div className="pnl-sec">Saves &amp; key skills<span className="ln"></span></div>
              <div className="cheat">
                {saves.map((s, i) => (
                  <Fragment key={`sv-${i}`}>
                    <span className="ck">{s.label}</span><span className="cv">{s.value}</span>
                  </Fragment>
                ))}
                {skills.map((s, i) => (
                  <Fragment key={`sk-${i}`}>
                    <span className="ck">{s.label}</span><span className="cv">{s.value}</span>
                  </Fragment>
                ))}
                {senses && (<><span className="ck">Senses</span><span className="cv">{senses}</span></>)}
              </div>
            </>
          )}

          {features.length > 0 && (
            <>
              <div className="pnl-sec">{isMonk ? 'Ki techniques' : 'Class features'}<span className="ln"></span></div>
              {features.map((f, i) => (
                <div className="tech" key={`ft-${i}`}>
                  <div className="tt">{f.name}</div>
                  {f.desc && <div className="tdsc">{f.desc}</div>}
                </div>
              ))}
            </>
          )}

          <div className="pnl-sec">Actions in a pinch<span className="ln"></span></div>
          <div className="cheat">
            {pinchActions.map((a, i) => (
              <Fragment key={`pa-${i}`}>
                <span className="ck">{a.label}</span><span className="cv">{a.value}</span>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="pnl-foot">
          <button className="btn" onClick={onClose}>
            <svg className="ic"><use href="#qr-arrow-ur" /></svg>Open full character sheet
          </button>
        </div>
      </aside>
    </>
  );
}

export default QuickReferencePanel;
