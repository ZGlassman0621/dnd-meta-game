import React, { useEffect, useRef, useState } from 'react';

// Roll math side panel (combat-loop fix, item 7). Zach 2026-11-23: "Tell
// me what to roll … engine will calculate that after the roll. Maybe in a
// side chat that just shows the math?" The engine never rolls for the
// player; this panel shows what it did with each number afterwards —
// die + modifiers = total against the AC — for the player's rolls and
// every enemy and companion roll in the fight.
export default function RollMathPanel({ entries, onClear }) {
  const [open, setOpen] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries, open]);

  if (!entries?.length) return null;

  return (
    <div style={{
      position: 'fixed', right: '1rem', bottom: '5.5rem', zIndex: 40,
      width: open ? 'min(360px, calc(100vw - 2rem))' : 'auto',
      background: 'rgba(15, 15, 25, 0.96)', border: '1px solid rgba(251, 191, 36, 0.35)',
      borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.45)', fontSize: '0.78rem', color: '#ddd'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', borderBottom: open ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
        <span style={{ color: '#fbbf24', fontWeight: 'bold', flex: 1 }}>Roll math</span>
        {open && (
          <button onClick={onClear} title="Clear the math log" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem' }}>Clear</button>
        )}
        <button onClick={() => setOpen((o) => !o)} title={open ? 'Hide' : 'Show the roll math'} style={{ background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer', fontSize: '0.8rem' }}>
          {open ? '▾' : `▸ ${entries.length}`}
        </button>
      </div>
      {open && (
        <div ref={listRef} style={{ maxHeight: '220px', overflowY: 'auto', padding: '0.35rem 0.6rem' }}>
          {entries.map((e, i) => (
            <div key={i} style={{ padding: '0.2rem 0', borderBottom: '1px dashed rgba(255,255,255,0.06)', fontFamily: 'ui-monospace, Consolas, monospace', lineHeight: 1.35 }}>
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
