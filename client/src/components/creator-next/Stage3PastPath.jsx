import { useMemo } from 'react'
import Tip from './Tooltip.jsx'
import spellsData from '../../data/spells.json' with { type: 'json' }
import { THEME_GOLD_MODIFIERS } from '../../data/themeGoldModifiers.js'
import { themeLocationOptions } from './themeLocation.js'
import { resolveChoiceOptions, isHeldOption } from './choiceOptions.js'
import { versatileThemeConflict } from './mixedAncestry.js'
import { deferredNoteFor, isDeferredSpecies } from './speciesAdapter.js'

/**
 * Creator-next Stage 3 — Past & Path (2026-11-06).
 *
 * THEME ONLY — themes replace backgrounds; there is no background
 * picker here (Zach, decided 2026-11-05; Stage 3 mappings draft
 * approved 2026-11-06 00:48 EST). The theme package is 2 signature
 * skills + the L1 theme ability + one FIXED origin feat + a FIXED
 * +2/+1 ASI + a gold modifier. No origin feat grants an ASI in 2024,
 * so the most any theme grants in one stat at L1 is +2, from the
 * theme ASI itself — there is nothing to stack and no stacking
 * callout is shown.
 *
 * Tooltips on EVERY choice via <Tip> (hover/focus/tap), never
 * title-attribute-only. No silent defaults: every picker starts
 * empty. Nothing is auto-filled: the player makes every pick
 * here, and no button fills picks for them (same rule as Stage 2
 * never picking a class).
 *
 * Data sources, and their honest limits:
 * - Themes ONLY from the server theme registry, passed in via props
 *   (`themes` array, or `{ themes: [...] }`). The shell fetches
 *   /api/themes; when unreachable it passes null and this component
 *   shows the gap instead of substituting backgrounds.json or any
 *   client theme list as registry truth. There is NO client themes
 *   fallback file.
 * - Per-theme client shape served by /api/themes: id, name,
 *   identity, description, signature skills, abilities,
 *   creation_choice_label/options, origin_feat +
 *   origin_feat_name/effect, origin_feat_spell_list,
 *   ability_score_increase. Field aliases are tolerated below
 *   (signature_skill_1/2, feat_name/feat_effect) because the
 *   endpoint is landing in parallel — but nothing is invented when
 *   a field is absent: a missing feat effect, ASI, or spell list
 *   renders as an honest gap note, not a filled-in value.
 * - Gold modifier from the existing client
 *   themeGoldModifiers.js (THEME_GOLD_MODIFIERS, decimal
 *   multipliers, −0.50 Urchin to +0.50 Noble) — display only.
 * - Magic Initiate: the spell list is FIXED by the theme and shown
 *   read-only (the theme's gift); the player picks only the
 *   spellcasting ability + 2 cantrips + 1 level-1 spell from that
 *   list, out of spells.json (cantrips keyed by lowercase class
 *   name; 1st-level spells filtered by their `classes` array).
 * - Musician / Skilled / Crafter subchoices expand through
 *   choiceOptions.js sentinels (any_instrument,
 *   any_skill_or_tool, any_artisan_tool) — the Stage 1
 *   choices-renderer pattern. All four subchoice pickers are
 *   checkbox multi-picks with maxCount enforced (Stage 2
 *   toggleMultiChoice pattern).
 * - Held-option gray-out: only where a held set actually exists.
 *   Species-granted spells (innateSpells on the species entry /
 *   picked variant) gray out in the Magic Initiate cantrip and
 *   spell pickers — a granted spell is never re-picked. No held
 *   set exists for instruments, skills/tools, or artisan's tools
 *   (species/class skill and tool grants live in trait prose, not
 *   structured fields — same limit Stage 1 records), so those
 *   pickers gray nothing out rather than inventing a held set.
 *
 * State keys (draft state in the shell): themeId, themePathChoice,
 * themePathData (the second path choice, e.g. Soldier active-duty),
 * originFeat, originFeatChoices { spellcasting_ability, cantrips[],
 * spell, instruments[], skills_or_tools[], artisan_tools[] }.
 * Feat and ASI attach to the THEME, not to the creation sub-choice
 * (outlander biome / city_watch home city / knight order type are
 * narrative/geographic only).
 */

const ABILITY_OPTIONS = ['Intelligence', 'Wisdom', 'Charisma']
const MAGIC_INITIATE_LISTS = ['cleric', 'druid', 'wizard']
const ABILITY_SHORT = {
  strength: 'Str', dexterity: 'Dex', constitution: 'Con',
  intelligence: 'Int', wisdom: 'Wis', charisma: 'Cha',
  str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha'
}

function prettify(id) {
  if (!id) return ''
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function featKeyOf(theme) {
  const raw = theme?.origin_feat ?? theme?.origin_feat_key ?? theme?.feat ?? ''
  return String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function featNameOf(theme) {
  return theme?.origin_feat_name || theme?.feat_name
    || prettify(featKeyOf(theme)) || ''
}

function featEffectOf(theme) {
  return theme?.origin_feat_effect || theme?.feat_effect || theme?.origin_feat_description || ''
}

function signatureSkillsOf(theme) {
  if (Array.isArray(theme?.signature_skills) && theme.signature_skills.length) {
    return theme.signature_skills.map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
  }
  if (Array.isArray(theme?.skills) && theme.skills.length) {
    return theme.skills.map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
  }
  return [theme?.signature_skill_1, theme?.signature_skill_2].filter(Boolean)
}

function l1AbilityOf(theme) {
  const list = Array.isArray(theme?.abilities) ? theme.abilities : []
  return list.find(a => a?.tier === 1) || list[0] || null
}

/** Render the fixed +2/+1 ASI as "+2 Wis, +1 Int" style text. */
function formatAsi(asi) {
  if (!asi) return ''
  if (typeof asi === 'string') return asi
  if (Array.isArray(asi)) {
    const parts = asi.map(e => {
      if (!e) return ''
      if (typeof e === 'string') return e
      const ability = e.ability || e.score || e.name || ''
      const bonus = e.bonus ?? e.value ?? e.amount
      return bonus != null && ability ? `+${bonus} ${ABILITY_SHORT[String(ability).toLowerCase()] || prettify(ability)}` : ''
    }).filter(Boolean)
    return parts.join(', ')
  }
  if (typeof asi === 'object') {
    return Object.entries(asi)
      .filter(([, v]) => typeof v === 'number' && v !== 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `+${v} ${ABILITY_SHORT[k.toLowerCase()] || prettify(k)}`)
      .join(', ')
  }
  return ''
}

function formatGoldModifier(themeId) {
  const mod = THEME_GOLD_MODIFIERS[themeId]
  if (mod == null) return ''
  if (mod === 0) return 'Starting gold unchanged'
  const pct = Math.round(Math.abs(mod) * 100)
  return mod > 0 ? `+${pct}% starting gold` : `−${pct}% starting gold`
}

function spellListOf(theme) {
  const raw = theme?.origin_feat_spell_list || theme?.origin_feat_list || theme?.magic_initiate_list || ''
  const list = String(raw || '').trim().toLowerCase()
  return MAGIC_INITIATE_LISTS.includes(list) ? list : ''
}

/**
 * Description for a Magic Initiate spell by name, from the bundled
 * spells.json (every cantrip and level-1 spell carries one). Searched
 * across all cantrip lists, then the level-1 list — spell names are
 * unique across both. Exported so the test calls the real lookup
 * instead of re-implementing it. Returns '' when the name is not in
 * the catalog — the picker then shows no description, never an
 * invented one.
 */
export function spellDescriptionFor(name) {
  if (!name) return ''
  const key = String(name).toLowerCase().trim()
  for (const list of Object.values(spellsData.cantrips || {})) {
    const hit = (list || []).find(s => String(s?.name || '').toLowerCase().trim() === key)
    if (hit?.description) return hit.description
  }
  const hit = ((spellsData.spells || {})['1st'] || [])
    .find(s => String(s?.name || '').toLowerCase().trim() === key)
  return hit?.description || ''
}

export default function Stage3PastPath({ state, set, themes = null, speciesEntry = null }) {
  const themeList = useMemo(() => {
    const src = Array.isArray(themes) ? themes : (Array.isArray(themes?.themes) ? themes.themes : null)
    if (!src) return null
    // Alphabetical by display name, so the picker order never depends
    // on registry/seed order (same pattern as the class/species sorts).
    return [...src].sort((a, b) => (a.name || prettify(a.id)).localeCompare(b.name || prettify(b.id)))
  }, [themes])
  const themeId = state.themeId || ''
  const theme = themeList?.find(t => t.id === themeId) || null
  const featKey = theme ? featKeyOf(theme) : ''
  const featName = theme ? featNameOf(theme) : ''
  const l1Ability = theme ? l1AbilityOf(theme) : null
  // Full theme preview (creator test-notes #15): every tier ability
  // the registry serves, sorted by tier — the expandable below
  // renders all four, so a player can plan the build ahead.
  const themeAbilities = theme ? [...(theme.abilities || [])].sort((a, b) => (a?.tier ?? 0) - (b?.tier ?? 0)) : []
  const asiText = theme ? formatAsi(theme.ability_score_increase ?? theme.ability_score_increases) : ''
  const goldText = theme ? formatGoldModifier(theme.id) : ''
  // Soldier second field (R2-11e, SERVER shape): creation_choice_second_field
  // { key, label, options } — the old client-side two-part shape is struck;
  // the server serves the second field this way (themes.js) and Review
  // §6 reads path_data as JSON { <key>: <value> }. The select still
  // binds state.themePathData (a string, the option value).
  const secondField = theme?.creation_choice_second_field || null
  const creationOptions2 = Array.isArray(secondField?.options) ? secondField.options : []
  const creationLabel2 = secondField?.label || ''
  // Location choice (R2-11g): a theme whose creation choice is a
  // location and carries creation_choice_source 'origin_regions'
  // offers the character's own origin setting's REGIONS to a non-FR
  // character ("Home Region") — never FR cities as if they were
  // local. FR origins (or an unset origin, or a setting with no
  // region list) keep the theme's served list and label ("Home City").
  // Shared with the shell's stale-pick clear (themeLocation.js).
  const { options: locationOptions, label: locationLabel } = themeLocationOptions(theme, state)
  const spellList = theme ? spellListOf(theme) : ''

  // The Versatile duplicate rule (R2-5): the theme feat must differ
  // from BOTH Versatile slots — the standalone human pick AND the
  // Mixed Ancestry trait pick. Either one matching blocks the save.
  // Judged by the shared versatileThemeConflict helper (the shell's
  // save gate uses the same call), never re-implemented here.
  const versatileDup = theme && !!(
    versatileThemeConflict(state.versatileFeat, featKey)
    || versatileThemeConflict(state.mixedAncestry?.versatileFeat, featKey)
  )

  // Species-granted spells (Stage 2's derivation): the picked
  // variant's innateSpells win, else the entry's. Only these gray
  // out in the Magic Initiate pickers — a granted spell is never
  // re-picked. No other held set exists for this stage.
  const selectedVariant = speciesEntry?.variants?.find(v => v.name === state.subrace) || null
  const innate = selectedVariant?.innateSpells?.length
    ? selectedVariant.innateSpells
    : (speciesEntry?.innateSpells || [])
  const heldCantrips = innate.filter(s => s && s.level === 0 && s.name).map(s => s.name)
  const heldSpells = innate.filter(s => s && s.level === 1 && s.name).map(s => s.name)

  const cantripOptions = useMemo(() => {
    if (featKey !== 'magic_initiate' || !spellList) return []
    const list = (spellsData.cantrips || {})[spellList] || []
    return list.map(s => s?.name).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [featKey, spellList])
  const level1Options = useMemo(() => {
    if (featKey !== 'magic_initiate' || !spellList) return []
    const list = (spellsData.spells || {})['1st'] || []
    return list
      .filter(s => s?.name && Array.isArray(s.classes) && s.classes.includes(spellList))
      .map(s => s.name)
      .sort((a, b) => a.localeCompare(b))
  }, [featKey, spellList])

  const update = (patch) => set({ ...state, ...patch })
  const pickTheme = (id) => {
    const next = themeList?.find(t => t.id === id) || null
    update({
      themeId: id,
      themePathChoice: '',
      themePathData: '',
      originFeat: next ? featKeyOf(next) : '',
      originFeatChoices: {}
    })
  }
  const setFeatChoice = (key, value) => update({
    originFeatChoices: { ...(state.originFeatChoices || {}), [key]: value }
  })
  const toggleFeatMulti = (key, option, maxCount) => {
    const cur = Array.isArray((state.originFeatChoices || {})[key]) ? [...(state.originFeatChoices || {})[key]] : []
    const at = cur.indexOf(option)
    if (at >= 0) cur.splice(at, 1)
    else if (!maxCount || cur.length < maxCount) cur.push(option)
    setFeatChoice(key, cur)
  }

  const selectStyle = {
    width: '100%', padding: '10px 12px', fontFamily: 'var(--serif)',
    fontSize: 16, background: 'var(--paper, #fff)', color: 'var(--ink, #222)',
    border: '1px solid var(--rule, #888)', borderRadius: 6
  }
  const labelStyle = { display: 'block', fontFamily: 'var(--serif)', fontSize: 15, margin: '18px 0 6px' }
  const checkStyle = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--serif)', fontSize: 15, margin: '4px 0' }
  // One shared checkbox-row style (creator test-notes #13/#18/#19):
  // a flex row keeps the checkbox on the same horizontal plane as
  // its name. The checkbox never shrinks.
  const checkInputStyle = { flex: '0 0 auto' }
  const choices = state.originFeatChoices || {}

  return (
    <div className="card">
      <div className="eyebrow">Stage 3 of 6</div>
      <h1 className="h-step">Past &amp; Path</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Pick a theme — the life your character lived before adventuring. A theme is a fixed package:
        two signature skills, a level-1 theme ability, one origin feat, a fixed ability-score increase,
        and a starting-gold modifier. Nothing here is pre-picked: every picker starts empty.
      </p>

      <label style={labelStyle} htmlFor="stage3-theme">
        Theme
        <Tip text="Your past life, and the package that comes with it: two signature skills, a level-1 ability, one fixed origin feat, and a fixed +2/+1 ability increase. The theme locks at creation — it shapes your skills, your starting gold, and what the world knows about you — but it never picks your class or your future." />
      </label>
      {themeList === null ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          Couldn&apos;t load the theme list — check your connection and refresh.
        </div>
      ) : themeList.length === 0 ? (
        <div className="help" style={{ fontStyle: 'normal' }}>
          No themes listed yet, so no theme can be picked here.
        </div>
      ) : (
        <select id="stage3-theme" style={selectStyle} value={themeId} onChange={e => pickTheme(e.target.value)}>
          <option value="">Choose a theme…</option>
          {themeList.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      {theme && (
        <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
          {theme.description || ''}
          {theme.identity && (
            <div style={{ marginTop: 6, fontStyle: 'italic' }}>{theme.identity}</div>
          )}
        </div>
      )}

      {isDeferredSpecies(speciesEntry) && (
        <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
          {deferredNoteFor(speciesEntry)} — its granted spells still gray out the Magic Initiate picks below.
        </div>
      )}

      {theme && (
        <>
          <div style={{ marginTop: 18 }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Signature skills</strong>
            <Tip text="The two skills your past life trained. They are part of the theme package — granted at submit, not chosen here — and they feed the Stage 4 dedup: a skill granted twice becomes a replacement pick of the same type, never a stack." />
            <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
              {signatureSkillsOf(theme).length ? signatureSkillsOf(theme).join(', ') : 'Not listed for this theme yet.'}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Level-1 theme ability</strong>
            <Tip text="The ability your theme grants at level 1. It is fixed by the theme — no choice here — and higher-tier theme abilities unlock as you level." />
            {l1Ability ? (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
                <strong>{l1Ability.name}</strong>
                {l1Ability.mechanics ? ` — ${l1Ability.mechanics}` : ''}
                {l1Ability.description && l1Ability.description !== l1Ability.mechanics ? (
                  <div style={{ marginTop: 4 }}>{l1Ability.description}</div>
                ) : null}
              </div>
            ) : (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
                No level-1 ability listed for this theme yet.
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Origin feat</strong>
            <Tip text="One fixed origin feat, part of the theme package — the theme decides it, you do not pick between feats. It is granted at submit along with the theme. No origin feat grants an ability-score increase in 2024, so this feat never adds to the +2/+1 below." />
            {featName ? (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
                <strong>{featName}</strong>
                {featEffectOf(theme) ? ` — ${featEffectOf(theme)}` : ' — no description listed for this feat yet.'}
              </div>
            ) : (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
                No origin feat listed for this theme yet.
              </div>
            )}
          </div>

          {theme && state.mixedAncestry?.forgoOriginFeat === true && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(231, 76, 60, 0.08)', border: '1px solid #e74c3c', color: '#c0392b', fontFamily: 'var(--serif)', fontSize: 15 }}>
              This theme&apos;s origin feat ({featName || 'see above'}) is forgone — your Mixed Ancestry trade gave up the feat for +4 power budget. The theme, its skills, and its ability increase still apply; only the feat is not granted. Turn the trade off at Stage 1 to take the feat instead.
            </div>
          )}

          {versatileDup && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(231, 76, 60, 0.08)', border: '1px solid #e74c3c', color: '#c0392b', fontFamily: 'var(--serif)', fontSize: 15 }}>
              Your Versatile feat ({featName || 'see above'}) is already this theme&apos;s origin feat — the Versatile feat must be a different origin feat. Change it at Stage 1 before continuing; this stage cannot be saved with the same feat in both slots.
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Ability-score increase</strong>
            <Tip text="A fixed +2 to one ability and +1 to another, part of the theme package. It is fixed by the theme — no choice here — and it is the only ability increase the theme grants: the origin feat above adds none. The Stage 4 Scores page will show the breakdown (base + theme)." />
            <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
              {asiText || 'Not listed for this theme yet.'}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Starting gold</strong>
            <Tip text="A modifier on your class baseline starting gold, fixed by the theme — a noble starts with more, an urchin with less. It changes only the starting gold, nothing else, and it cannot change later." />
            <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
              {goldText || 'No gold modifier recorded for this theme.'}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <details>
              <summary style={{ fontFamily: 'var(--serif)', fontSize: 15, cursor: 'pointer' }}>
                <strong>Full theme preview — levels 1, 5, 11, and 17</strong>
              </summary>
              <div className="help" style={{ fontStyle: 'normal', marginTop: 8 }}>
                Everything this theme grants as you level, so you can plan the build ahead — nothing here is a choice, it all comes with the theme.
              </div>
              {[1, 5, 11, 17].map(tier => {
                const ability = themeAbilities.find(a => a?.tier === tier)
                return (
                  <div key={tier} style={{ marginTop: 10 }}>
                    <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Level {tier}</strong>
                    {ability ? (
                      <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
                        <strong>{ability.name}</strong>
                        {ability.mechanics ? ` — ${ability.mechanics}` : ''}
                        {ability.description && ability.description !== ability.mechanics ? (
                          <div style={{ marginTop: 4 }}>{ability.description}</div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
                        No level-{tier} ability listed for this theme yet.
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
                Also in this package: {featName || 'origin feat'} · {asiText || 'ability increase'} · {signatureSkillsOf(theme).join(', ') || 'signature skills'} · {goldText || 'starting gold'}.
              </div>
            </details>
          </div>
        </>
      )}

      {theme && locationOptions.length > 0 && (
        <>
          <label style={labelStyle} htmlFor="stage3-path-choice">
            {locationLabel}
            <Tip text="A detail of your past life — where you lived it, or which order you swore to. It is narrative and geographic only: your feat and ability increase above attach to the theme itself, never to this choice, so no option here is stronger than another." />
          </label>
          <select id="stage3-path-choice" style={selectStyle} value={state.themePathChoice || ''} onChange={e => update({ themePathChoice: e.target.value })}>
            <option value="">Choose…</option>
            {locationOptions.map(o => (
              <option key={o.value ?? o.label} value={o.value ?? o.label}>{o.label || o.value}</option>
            ))}
          </select>
          {(() => {
            const picked = locationOptions.find(o => (o.value ?? o.label) === state.themePathChoice)
            return picked?.description ? (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>{picked.description}</div>
            ) : null
          })()}
        </>
      )}

      {theme && creationOptions2.length > 0 && (
        <>
          <label style={labelStyle} htmlFor="stage3-path-choice-2">
            {creationLabel2 || 'Second choice'}
            <Tip text="A second detail of your past life, part of the same theme package — it is narrative only, like the choice above, and it never changes your feat, ability increase, or skills." />
          </label>
          <select id="stage3-path-choice-2" style={selectStyle} value={state.themePathData || ''} onChange={e => update({ themePathData: e.target.value })}>
            <option value="">Choose…</option>
            {creationOptions2.map(o => (
              <option key={o.value ?? o.label} value={o.value ?? o.label}>{o.label || o.value}</option>
            ))}
          </select>
          {(() => {
            const picked = creationOptions2.find(o => (o.value ?? o.label) === state.themePathData)
            return picked?.description ? (
              <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>{picked.description}</div>
            ) : null
          })()}
        </>
      )}

      {theme && featKey === 'magic_initiate' && (
        <>
          <div style={{ marginTop: 18 }}>
            <strong style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>Spell list — fixed by the theme</strong>
            <Tip text="Magic Initiate draws all its spells from ONE list, and the theme fixes which one — this theme's gift is the list named here. You do not pick a list, and the list never changes later. Your picks below are only the ability and the spells themselves." />
            <div className="help" style={{ fontStyle: 'normal', marginTop: 4 }}>
              {spellList
                ? `${prettify(spellList)} spell list — two cantrips and one level-1 spell, all from this list.`
                : 'No spell list is available for this theme yet, so no Magic Initiate spells can be picked here.'}
            </div>
          </div>

          {spellList && (
            <>
              <label style={labelStyle} htmlFor="stage3-mi-ability">
                Spellcasting ability
                <Tip text="The ability your Magic Initiate spells use. Pick the one that matches how you cast — Intelligence, Wisdom, or Charisma. It locks with the feat at creation and cannot be swapped later." />
              </label>
              <select id="stage3-mi-ability" style={selectStyle} value={choices.spellcasting_ability || ''} onChange={e => setFeatChoice('spellcasting_ability', e.target.value)}>
                <option value="">Choose an ability…</option>
                {ABILITY_OPTIONS.map(a => (<option key={a} value={a}>{a}</option>))}
              </select>

              <div style={{ marginTop: 6 }}>
                <span style={labelStyle}>Cantrips (choose 2)
                  <Tip text="Two cantrips from the fixed list above. They are granted by the feat, never counted against your class cantrips known or prepared. A cantrip your species already grants is grayed out — it is already yours, so it is not picked again here." />
                </span>
                {cantripOptions.length === 0 ? (
                  <div className="help" style={{ fontStyle: 'normal' }}>
                    No cantrips found for this spell list in the spell catalog.
                  </div>
                ) : (
                  cantripOptions.map(c => {
                    const held = isHeldOption(c, heldCantrips)
                    return (
                      <label key={c} style={{ ...checkStyle, opacity: held ? 0.55 : 1 }}>
                        <input type="checkbox" style={checkInputStyle} disabled={held} checked={Array.isArray(choices.cantrips) && choices.cantrips.includes(c)} onChange={() => toggleFeatMulti('cantrips', c, 2)} /> {held ? `${c} — already granted` : c}
                      </label>
                    )
                  })
                )}
                {(Array.isArray(choices.cantrips) ? choices.cantrips : []).map(c => (
                  <div key={c} className="help" style={{ fontStyle: 'normal', marginTop: 6 }}>
                    <strong>{c}</strong>{spellDescriptionFor(c) ? ` — ${spellDescriptionFor(c)}` : ''}
                  </div>
                ))}
              </div>

              <label style={labelStyle} htmlFor="stage3-mi-spell">
                Level-1 spell (choose 1)
                <Tip text="One level-1 spell from the fixed list above. It is always prepared, castable once per Long Rest without a slot and with spell slots thereafter. A spell your species already grants is grayed out — it is already yours, so it is not picked again here." />
              </label>
              {level1Options.length === 0 ? (
                <div className="help" style={{ fontStyle: 'normal' }}>
                  No level-1 spells found for this spell list in the spell catalog.
                </div>
              ) : (
                <select id="stage3-mi-spell" style={selectStyle} value={choices.spell || ''} onChange={e => setFeatChoice('spell', e.target.value)}>
                  <option value="">Choose a spell…</option>
                  {level1Options.map(s => {
                    const held = isHeldOption(s, heldSpells)
                    return (
                      <option key={s} value={s} disabled={held}>{held ? `${s} — already granted` : s}</option>
                    )
                  })}
                </select>
              )}
              {choices.spell && spellDescriptionFor(choices.spell) && (
                <div className="help" style={{ fontStyle: 'normal', marginTop: 10 }}>
                  {spellDescriptionFor(choices.spell)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {theme && featKey === 'musician' && (
        <div style={{ marginTop: 6 }}>
          <span style={labelStyle}>Instruments (choose 3)
            <Tip text="Three musical instruments you gain proficiency with. Proficiency here is permanent — it locks at creation and travels with you. Playing one as you finish a rest gives Heroic Inspiration to allies who hear it." />
          </span>
          {(resolveChoiceOptions({ options: 'any_instrument' }) || []).map(o => (
            <label key={o.value} style={checkStyle}>
              <input type="checkbox" style={checkInputStyle} checked={Array.isArray(choices.instruments) && choices.instruments.includes(o.value)} onChange={() => toggleFeatMulti('instruments', o.value, 3)} /> {o.label || o.value}
            </label>
          ))}
        </div>
      )}

      {theme && featKey === 'skilled' && (
        <div style={{ marginTop: 6 }}>
          <span style={labelStyle}>Skills or tools (choose 3)
            <Tip text="Proficiency in any combination of three skills or tools of your choice. These are new proficiencies — they lock at creation. If one duplicates a proficiency you already hold, Stage 4 dedup turns the duplicate into a replacement pick of the same type instead of a stack." />
          </span>
          {(resolveChoiceOptions({ options: 'any_skill_or_tool' }) || []).map(o => (
            <label key={o.value} style={checkStyle}>
              <input type="checkbox" style={checkInputStyle} checked={Array.isArray(choices.skills_or_tools) && choices.skills_or_tools.includes(o.value)} onChange={() => toggleFeatMulti('skills_or_tools', o.value, 3)} /> {o.label || o.value}
            </label>
          ))}
        </div>
      )}

      {theme && featKey === 'crafter' && (
        <div style={{ marginTop: 6 }}>
          <span style={labelStyle}>Artisan&apos;s tools (choose 3)
            <Tip text="Proficiency with three artisan's tools of your choice. They lock at creation, and the feat's crafting — a 20% discount on nonmagical items and one piece of gear crafted at the end of a Long Rest — needs the tools you pick here." />
          </span>
          {(resolveChoiceOptions({ options: 'any_artisan_tool' }) || []).map(o => (
            <label key={o.value} style={checkStyle}>
              <input type="checkbox" style={checkInputStyle} checked={Array.isArray(choices.artisan_tools) && choices.artisan_tools.includes(o.value)} onChange={() => toggleFeatMulti('artisan_tools', o.value, 3)} /> {o.label || o.value}
            </label>
          ))}
        </div>
      )}

    </div>
  )
}
