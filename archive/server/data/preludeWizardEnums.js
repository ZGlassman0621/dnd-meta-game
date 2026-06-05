/**
 * Server-side mirror of the Phase 2 Prelude wizard enums (Q8 siblings,
 * Q9 authority figure). Client source of truth is
 * `client/src/data/preludeSetup.js` (`SIBLING_OPTIONS`, `AUTHORITY_FIGURES`).
 *
 * Mirrored here so the server can render setup answers into prompt prose
 * without importing client code. Keep in sync — drift means Opus / Sonnet
 * see different labels than the player picked, which weakens the
 * "anchored to setup" promise of the arc plan.
 *
 * The enum values themselves are the authoritative storage form (e.g.
 * `siblings = 'older_one'`); the labels here are display strings for
 * humans / AI and the descriptions provide the same one-line clarifier
 * the player saw at setup time.
 */

export const SIBLING_OPTIONS = [
  { value: 'only_child', label: 'Only child' },
  { value: 'younger_one', label: 'Younger sibling' },
  { value: 'younger_many', label: 'Younger siblings' },
  { value: 'older_one', label: 'Older sibling' },
  { value: 'older_many', label: 'Older siblings' },
  { value: 'twin', label: 'Twin' },
  { value: 'mixed', label: 'Mix of younger and older' },
  { value: 'lost_one', label: 'Lost sibling (died or vanished)' },
  { value: 'lost_many', label: 'Lost siblings (died or vanished)' }
];

export const AUTHORITY_FIGURES = [
  { value: 'parent', label: 'A parent', description: "the household's adult presence, for better or worse." },
  { value: 'sibling', label: 'An older sibling', description: 'raised you in everything but name.' },
  { value: 'mentor', label: 'A mentor', description: 'a teacher, master, priest, or elder who taught you something deliberately.' },
  { value: 'guardian', label: 'A guardian', description: 'an adult who took responsibility for you without being family.' },
  { value: 'captor', label: 'A captor', description: 'someone who held power over you against your will.' },
  { value: 'employer', label: 'An employer', description: 'you worked for them young, and they shaped you through that work.' },
  { value: 'rival', label: 'A rival', description: 'another child or adolescent whose presence defined yours.' },
  { value: 'none', label: 'No one', description: 'you raised yourself.' }
];

export function findSiblingOption(value) {
  return SIBLING_OPTIONS.find(s => s.value === value) || null;
}

export function findAuthorityFigure(value) {
  return AUTHORITY_FIGURES.find(a => a.value === value) || null;
}
