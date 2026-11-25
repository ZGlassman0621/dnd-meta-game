// Level-up feat picker helpers (feat-addition-14). Plain JS so the tests
// can import them without JSX.

// Half-feat +1 options. feats.json stores the +1 as
// { ability: 'cha', amount: 1 } or { choice: [...], amount: 1 }; the old
// dropdown listed Object.keys() of that object — "ABILITY", "AMOUNT",
// "CHOICE" — so no half-feat's +1 ever reached the server as a real
// ability key (fix-as-you-find-it).
//
// repo-check-fixes-feats (2024 PHB): Resilient's +1 carries
// `lackingSaveProficiency: true` — the book lets you pick only an ability
// you lack saving throw proficiency in, so pass the character's save
// proficiencies and those abilities drop out of the list.
export function featAbilityOptions(feat, { saveProficiencies } = {}) {
  const inc = feat?.abilityIncrease
  if (!inc) return []
  let opts = []
  if (Array.isArray(inc)) opts = inc
  else if (Array.isArray(inc.choice)) opts = inc.choice
  else if (typeof inc.ability === 'string') opts = [inc.ability]
  if (inc.lackingSaveProficiency && Array.isArray(saveProficiencies)) {
    opts = opts.filter((ab) => !saveProficiencies.includes(ab))
  }
  return opts
}

// The cap a feat's +1 may raise a score to (book: 20; Epic Boons: 30).
export function featAbilityMax(feat) {
  const m = Number(feat?.abilityIncrease?.max)
  return Number.isFinite(m) && m > 0 ? m : 20
}

// Structured ability prerequisites. `prerequisiteScore` ({ dex: 13 }) needs
// every listed score; `prerequisiteScoreAny` ({ str: 13, dex: 13 }) is the
// book's "Strength or Dexterity 13+" — any one listed score is enough.
export function featPrerequisiteMet(feat, scores) {
  const s = scores || {}
  const req = feat?.prerequisiteScore
  if (req && typeof req === 'object'
    && !Object.entries(req).every(([ab, min]) => Number(s[ab] ?? 0) >= Number(min))) return false
  const any = feat?.prerequisiteScoreAny
  if (any && typeof any === 'object'
    && !Object.entries(any).some(([ab, min]) => Number(s[ab] ?? 0) >= Number(min))) return false
  return true
}

// Book level prerequisite: General feats Level 4+, Epic Boons Level 19+.
export function featLevelMet(feat, characterLevel) {
  const min = Number(feat?.minLevel) || 1
  return Number(characterLevel) >= min
}

const featIdOf = (f) => (typeof f === 'string' ? f : (f?.key || f?.name || ''))
  .toLowerCase().replace(/[\s-]+/g, '_')

// A feat already on the character, unless the book marks it Repeatable.
export function featAlreadyHeld(key, feat, heldFeats) {
  if (feat?.repeatable) return false
  const want = [key, feat?.name].filter(Boolean).map((x) => featIdOf(x))
  return (heldFeats || []).some((h) => want.includes(featIdOf(h)) || want.includes(featIdOf(h?.name)))
}

// Saving throw proficiencies the Resilient rule judges against: the
// starting class's two saves plus any ability an earlier Resilient took.
export function characterSaveProficiencies(classSaves, heldFeats) {
  const out = new Set(Array.isArray(classSaves) ? classSaves : [])
  for (const f of heldFeats || []) {
    if (f && typeof f === 'object' && featIdOf(f) === 'resilient' && f.abilityChoice) out.add(f.abilityChoice)
  }
  return [...out]
}

// Why this feat cannot be taken at this level-up, or null when it can.
// Enforced: level, ability-score prerequisites, the Fighting Style Feature
// (a character that already has a fighting style has the feature), already
// held (non-Repeatable), and Resilient with no ability left. The armor /
// shield training and Spellcasting / Pact Magic prerequisites are shown in
// the text but not checked here (no reliable source on the character).
export function featPickBlockReason(key, feat, ctx = {}) {
  if (!feat) return 'unknown feat'
  if (!featLevelMet(feat, ctx.level)) return `requires level ${feat.minLevel}`
  if (!featPrerequisiteMet(feat, ctx.scores)) return `requires ${feat.prerequisites}`
  if (feat.prerequisiteFeature === 'fighting_style' && !ctx.hasFightingStyle) return 'requires the Fighting Style feature'
  if (featAlreadyHeld(key, feat, ctx.heldFeats)) return 'already taken'
  if (feat.abilityIncrease && featAbilityOptions(feat, ctx).length === 0) return 'no eligible ability'
  return null
}
