// Story-choice descriptions for the creator's Stage 5 (creator-round-3,
// items 5 and 6). Written from the 2024 Player's Handbook — Chapter 2
// "Alignment" and the Chapter 6 lifestyle expenses — in the builder's own
// words: summaries of the book's meaning, NOT quotations, and not checked
// line by line against a physical copy (the report flags that).
// UPDATE (repo-check-fixes-alignment-lifestyle, 2026-11-25): eight entries
// are now the 2024 PHB's own wording, transcribed from Zach's photos of
// PHB pp. 39–40 and 230–233 — Chaotic Good and Neutral Evil, and the
// Wretched, Squalid, Poor, Modest, Comfortable and Aristocratic lifestyles.
// The other entries keep the builder’s summaries above; the 2026-11-24 repo
// check found their wording already tracks the book. Apostrophes are the
// typographic ’ this file already uses.
// Lifestyle daily costs are the in-repo values (server/data/equipment2024.js
// SERVICES.lifestyles, copper pieces per day); a test keeps the two equal.

export const ALIGNMENT_DESCRIPTIONS = {
  'Lawful Good': 'You try to do the right thing as society expects it — the knight who fights injustice and protects the innocent without hesitation.',
  'Neutral Good': 'You do the best you can to help others as they need it, working within the rules without feeling bound by them.',
  'Chaotic Good': 'Chaotic Good creatures act as their conscience directs with little regard for what others expect. A rebel who waylays a cruel baron’s tax collectors and uses the stolen money to help the poor is probably Chaotic Good.',
  'Lawful Neutral': 'You act by law, tradition, or a personal code — a disciplined way of life that neither pleas nor temptations sway.',
  'True Neutral': 'You steer clear of moral questions and take no side, doing what seems best at the time. (The 2024 rules call this alignment Neutral.)',
  'Chaotic Neutral': 'You follow your whims and value your own freedom above all else — the scoundrel who wanders the land living by their wits.',
  'Lawful Evil': 'You take what you want methodically, within the limits of a code, tradition, or loyalty — the aristocrat who exploits the people while scheming for power.',
  'Neutral Evil': 'Neutral Evil is the alignment of those who are untroubled by the harm they cause as they pursue their desires. A criminal who robs and murders as they please is probably Neutral Evil.',
  'Chaotic Evil': 'You act with arbitrary violence, driven by hatred or bloodlust.',
  'Unaligned': 'You claim none of the nine alignments. In the rules, a creature with no capacity for moral choice, such as a beast, has no alignment.',
}

export const LIFESTYLES = [
  { name: 'Wretched', costPerDayCp: 0, description: 'You survive via chance and charity. You’re often exposed to natural dangers as a result of sleeping outside.' },
  { name: 'Squalid', costPerDayCp: 10, description: 'You spend the bare minimum for your necessities. You might be exposed to unhealthy conditions and opportunistic criminals.' },
  { name: 'Poor', costPerDayCp: 20, description: 'You spend frugally for your necessities.' },
  { name: 'Modest', costPerDayCp: 100, description: 'You support yourself at an average level.' },
  { name: 'Comfortable', costPerDayCp: 200, description: 'You spend modestly for your necessities and enjoy a few luxuries.' },
  { name: 'Wealthy', costPerDayCp: 400, description: 'A spacious home or the best rooms in town, fine food, and servants to attend you.' },
  { name: 'Aristocratic', costPerDayCp: 1000, description: 'You pay for the best and might have a staff that supports your lifestyle. Others notice your wealth and might encourage you to share it, either legally or otherwise.' },
]

/** "Free", "1 sp a day", "1 gp a day", from a copper-piece daily cost. */
export function formatDailyCost(cp) {
  const n = Number(cp) || 0
  if (n <= 0) return 'Free'
  if (n % 100 === 0) return `${n / 100} gp a day`
  if (n % 10 === 0) return `${n / 10} sp a day`
  return `${n} cp a day`
}
