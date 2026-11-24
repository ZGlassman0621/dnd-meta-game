// Story-choice descriptions for the creator's Stage 5 (creator-round-3,
// items 5 and 6). Written from the 2024 Player's Handbook — Chapter 2
// "Alignment" and the Chapter 6 lifestyle expenses — in the builder's own
// words: summaries of the book's meaning, NOT quotations, and not checked
// line by line against a physical copy (the report flags that).
// Lifestyle daily costs are the in-repo values (server/data/equipment2024.js
// SERVICES.lifestyles, copper pieces per day); a test keeps the two equal.

export const ALIGNMENT_DESCRIPTIONS = {
  'Lawful Good': 'You try to do the right thing as society expects it — the knight who fights injustice and protects the innocent without hesitation.',
  'Neutral Good': 'You do the best you can to help others as they need it, working within the rules without feeling bound by them.',
  'Chaotic Good': 'You act as your conscience directs, with little regard for what others expect — the rebel who waylays a cruel baron’s tax collectors.',
  'Lawful Neutral': 'You act by law, tradition, or a personal code — a disciplined way of life that neither pleas nor temptations sway.',
  'True Neutral': 'You steer clear of moral questions and take no side, doing what seems best at the time. (The 2024 rules call this alignment Neutral.)',
  'Chaotic Neutral': 'You follow your whims and value your own freedom above all else — the scoundrel who wanders the land living by their wits.',
  'Lawful Evil': 'You take what you want methodically, within the limits of a code, tradition, or loyalty — the aristocrat who exploits the people while scheming for power.',
  'Neutral Evil': 'You do whatever you can get away with, without compassion or qualms.',
  'Chaotic Evil': 'You act with arbitrary violence, driven by hatred or bloodlust.',
  'Unaligned': 'You claim none of the nine alignments. In the rules, a creature with no capacity for moral choice, such as a beast, has no alignment.',
}

export const LIFESTYLES = [
  { name: 'Wretched', costPerDayCp: 0, description: 'You live on the streets or in the wild, sleeping wherever you can and scrounging for food, exposed to disease, hunger, and violence.' },
  { name: 'Squalid', costPerDayCp: 10, description: 'A leaky stable, a mud-floored hut, or a vermin-ridden flophouse — a roof against the weather, among desperate company.' },
  { name: 'Poor', costPerDayCp: 20, description: 'Plain food, a cheap shared room, and threadbare clothes. You get by, but comfort and safety are never certain.' },
  { name: 'Modest', costPerDayCp: 100, description: 'A clean, simple room and plain, filling meals — the way most working people live.' },
  { name: 'Comfortable', costPerDayCp: 200, description: 'A small house or a private room at a good inn, good food, and decent clothes — the life of a successful merchant or skilled tradesperson.' },
  { name: 'Wealthy', costPerDayCp: 400, description: 'A spacious home or the best rooms in town, fine food, and servants to attend you.' },
  { name: 'Aristocratic', costPerDayCp: 1000, description: 'Estates, the finest food and clothing, retainers, and a place in the highest circles of society — with all the politics that come with it. (This is the least it costs.)' },
]

/** "Free", "1 sp a day", "1 gp a day", from a copper-piece daily cost. */
export function formatDailyCost(cp) {
  const n = Number(cp) || 0
  if (n <= 0) return 'Free'
  if (n % 100 === 0) return `${n / 100} gp a day`
  if (n % 10 === 0) return `${n / 10} sp a day`
  return `${n} cp a day`
}
