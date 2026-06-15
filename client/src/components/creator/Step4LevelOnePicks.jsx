import { useMemo } from 'react'
import classesData from '../../data/classes.json'
import spellsData from '../../data/spells.json'

/**
 * Step 4 — "Other level-1 picks". Replaces the old placeholder with the real
 * per-class L1 mechanical choices the creator was missing:
 *   - Cantrips (any class with cantripsKnown[0] > 0)
 *   - L1 spells: "Limited known" casters pick spellsKnownByLevel[0]; the Wizard
 *     ("Spellbook") picks its 6 starting spellbook spells. Prepared casters
 *     (cleric/druid — "All prepared") pick cantrips only and prepare in play.
 *   - Fighting style (Fighter only at L1).
 *
 * Rogue Expertise lives in Step 5 instead (it picks from the skills chosen by the
 * skills picker, which runs in Step 5).
 *
 * Counts come from classes.json `spellcasting`; spell lists from spells.json
 * (cantrips keyed by class; leveled spells are a flat list filtered by each
 * entry's `classes` array). Selections persist as plain name strings in
 * known_cantrips / known_spells / fighting_style.
 */

const FIGHTING_STYLES = [
  { id: 'archery', name: 'Archery', desc: '+2 bonus to attack rolls with ranged weapons.' },
  { id: 'defense', name: 'Defense', desc: '+1 to AC while you are wearing armor.' },
  { id: 'dueling', name: 'Dueling', desc: '+2 to damage with a one-handed melee weapon and no other weapon.' },
  { id: 'great_weapon_fighting', name: 'Great Weapon Fighting', desc: 'Reroll 1s and 2s on damage dice with a two-handed melee weapon.' },
  { id: 'protection', name: 'Protection', desc: 'Use a reaction and a shield to impose disadvantage on an attack against an ally within 5 ft.' },
  { id: 'two_weapon_fighting', name: 'Two-Weapon Fighting', desc: 'Add your ability modifier to the damage of the off-hand attack.' }
]

function PickGroup({ title, remaining, total, options, selectedNames, onToggle }) {
  const atCap = remaining <= 0
  return (
    <div className="block" style={{ marginTop: 18, marginBottom: 0 }}>
      <div className="block-label">
        <span className="l">{title}</span>
        <span className="hint">{remaining > 0 ? `choose ${remaining} more (of ${total})` : `${total} chosen`}</span>
      </div>
      {options.length === 0 ? (
        <div className="fhelp" style={{ marginTop: 0 }}>No options found for this class.</div>
      ) : (
        <div className="pillrow">
          {options.map(opt => {
            const name = opt.name
            const seld = selectedNames.includes(name)
            return (
              <button
                key={name}
                type="button"
                className={`selpill ${seld ? 'on' : ''}`.trim()}
                disabled={!seld && atCap}
                title={opt.school || ''}
                onClick={() => onToggle(name)}
              >
                {name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Step4LevelOnePicks({ state, set }) {
  const classId = state.class_id || ''
  const cls = classId ? classesData[classId] : null
  const sc = cls?.spellcasting || null

  const cantripCount = sc?.cantripsKnown?.[0] ?? 0
  const cantripOptions = useMemo(() => spellsData.cantrips?.[classId] || [], [classId])

  const isSpellbook = sc?.spellsKnown === 'Spellbook'
  const isLimitedKnown = sc?.spellsKnown === 'Limited known'
  // Wizards begin with a 6-spell spellbook; "Limited known" casters use the table.
  const spellCount = isSpellbook ? 6 : (isLimitedKnown ? (sc?.spellsKnownByLevel?.[0] ?? 0) : 0)
  const spellOptions = useMemo(() => {
    if (spellCount <= 0) return []
    const first = spellsData.spells?.['1st'] || {}
    return Object.values(first).filter(sp => Array.isArray(sp.classes) && sp.classes.includes(classId))
  }, [classId, spellCount])

  const isFighter = classId === 'fighter'
  const knownCantrips = state.known_cantrips || []
  const knownSpells = state.known_spells || []

  const toggle = (key, list, name, cap) => {
    if (list.includes(name)) set({ ...state, [key]: list.filter(n => n !== name) })
    else if (list.length < cap) set({ ...state, [key]: [...list, name] })
  }

  if (!cls) return null

  const nothingToPick = cantripCount <= 0 && spellCount <= 0 && !isFighter

  return (
    <div className="block subrow" style={{ marginBottom: 0, marginTop: 18 }}>
      <div className="block-label">
        <span className="l">Other level-1 picks</span>
        <span className="hint">{nothingToPick ? 'nothing to choose at level 1' : 'cantrips, spells, fighting style'}</span>
      </div>

      {nothingToPick && (
        <div className="fhelp" style={{ marginTop: 0 }}>
          {cls.name} has no extra level-1 selections — your kit comes from class features and equipment.
        </div>
      )}

      {cantripCount > 0 && (
        <PickGroup
          title="Cantrips"
          remaining={cantripCount - knownCantrips.length}
          total={cantripCount}
          options={cantripOptions}
          selectedNames={knownCantrips}
          onToggle={(name) => toggle('known_cantrips', knownCantrips, name, cantripCount)}
        />
      )}

      {spellCount > 0 && (
        <PickGroup
          title={isSpellbook ? 'Spellbook · 1st-level spells' : 'Known spells · 1st level'}
          remaining={spellCount - knownSpells.length}
          total={spellCount}
          options={spellOptions}
          selectedNames={knownSpells}
          onToggle={(name) => toggle('known_spells', knownSpells, name, spellCount)}
        />
      )}

      {isFighter && (
        <div className="block" style={{ marginTop: 18, marginBottom: 0 }}>
          <div className="block-label">
            <span className="l">Fighting style</span>
            <span className="hint">how you fight</span>
          </div>
          <div className="opt-grid c2" role="radiogroup" aria-label="Fighting style">
            {FIGHTING_STYLES.map(fs => {
              const seld = state.fighting_style === fs.id
              return (
                <button
                  key={fs.id}
                  type="button"
                  className={`opt ${seld ? 'sel' : ''}`.trim()}
                  role="radio"
                  aria-checked={seld}
                  onClick={() => set({ ...state, fighting_style: seld ? '' : fs.id })}
                >
                  <div className="ot">{fs.name}</div>
                  <div className="od">{fs.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
