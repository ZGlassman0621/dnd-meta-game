// Level-up feat picker helpers (feat-addition-14). Plain JS so the tests
// can import them without JSX.

// Half-feat +1 options. feats.json stores the +1 as
// { ability: 'cha', amount: 1 } or { choice: [...], amount: 1 }; the old
// dropdown listed Object.keys() of that object — "ABILITY", "AMOUNT",
// "CHOICE" — so no half-feat's +1 ever reached the server as a real
// ability key (fix-as-you-find-it).
export function featAbilityOptions(feat) {
  const inc = feat?.abilityIncrease
  if (!inc) return []
  if (Array.isArray(inc)) return inc
  if (Array.isArray(inc.choice)) return inc.choice
  if (typeof inc.ability === 'string') return [inc.ability]
  return []
}

// Structured prerequisite (feats.json `prerequisiteScore`, e.g. { dex: 13 }).
// Free-text prerequisites (most book feats) are shown, not enforced — the
// survey found no prerequisite enforcement anywhere in the game.
export function featPrerequisiteMet(feat, scores) {
  const req = feat?.prerequisiteScore
  if (!req || typeof req !== 'object') return true
  return Object.entries(req).every(([ab, min]) => Number((scores || {})[ab] ?? 0) >= Number(min))
}
