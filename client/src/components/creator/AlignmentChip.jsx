/**
 * Alignment chip — small inline indicator for the 9-square 5e alignment
 * code (LG / NG / CG / LN / N / CN / LE / NE / CE).
 *
 * Per Decision 3 (DECISION_LOG 2026-05-02): always-visible inline
 * alongside prompt text on Step 7's personality / ideals / bonds /
 * flaws prompt lists. Modest visual weight — chip / pill style, never
 * hidden behind hover.
 *
 * Re-used by AlignmentGridPicker for the alignment field selector.
 */

const ALIGNMENT_NAMES = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'True Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil'
}

// Per-alignment description + behavior examples — surfaces in Step 7's
// alignment grid below the player's current pick. Distilled from the
// canonical 5e PHB / SRD alignment definitions; the behavior examples
// are illustrative, not exhaustive.
const ALIGNMENT_DESCRIPTIONS = {
  LG: {
    summary: 'Acts as a good person is expected or required to act, doing what the law and tradition demand because it produces the most good.',
    examples: [
      'Returns the lost coinpurse to the magistrate even when no one would notice if they kept it.',
      'Refuses to break a sworn oath even when bending it would save a friend.'
    ]
  },
  NG: {
    summary: 'Does the most good they can without bias for or against authority. Helps the people in front of them; the rules are tools, not goals.',
    examples: [
      'Smuggles refugees past a corrupt border guard without sentiment about either the law or the guard.',
      'Gives last copper to a beggar without making a show of it.'
    ]
  },
  CG: {
    summary: 'Acts according to their own conscience, with little regard for what others expect. Believes in goodness more than in rules.',
    examples: [
      'Picks a noble\'s pocket to feed an orphan, then leaves a flippant note.',
      'Defies a king\'s decree to free a wrongly imprisoned friend, accepting the consequences with a shrug.'
    ]
  },
  LN: {
    summary: 'Acts in accordance with law, tradition, or a personal code regardless of the moral cost. Order is the highest value.',
    examples: [
      'Carries out a death sentence even when convinced of the prisoner\'s innocence — the verdict was rendered.',
      'Refuses to negotiate with rebels because the throne does not negotiate with rebels.'
    ]
  },
  N: {
    summary: 'Acts as nature or pragmatism dictates. Avoids both sides of moral arguments — the world is what it is.',
    examples: [
      'Helps a wolf pack survive a hard winter by culling weak members of a deer herd.',
      'Refuses to take sides in a war between two equally entitled lords.'
    ]
  },
  CN: {
    summary: 'Follows whim, valuing personal freedom above all. Resents authority instinctively, even authority that would help.',
    examples: [
      'Takes a job they don\'t need just because the offer came at the wrong time and they want to spite the asker.',
      'Walks out of a steady contract for a long-shot adventure on a whim.'
    ]
  },
  LE: {
    summary: 'Methodically takes what they want within the limits of their personal code, tradition, or the law. Order is a weapon.',
    examples: [
      'Manipulates a guild charter to legally seize a rival\'s holdings, then enforces the charter ruthlessly.',
      'Honors a bargain even with someone they despise, because the bargain itself has weight.'
    ]
  },
  NE: {
    summary: 'Does what they can get away with, without compunction. Takes pleasure in others\' misfortune when convenient; mostly indifferent to it.',
    examples: [
      'Sells out a former comrade for a modest profit and feels no particular way about it.',
      'Refuses to spare a wounded enemy because spared enemies sometimes return.'
    ]
  },
  CE: {
    summary: 'Acts on arbitrary cruelty, hot anger, and lust for power or destruction. Bridles at any constraint — internal or external.',
    examples: [
      'Sets fire to a building to escape a fight, indifferent to the residents.',
      'Breaks a captured enemy\'s mind for the satisfaction of it, then complains about cleanup.'
    ]
  }
}

export default function AlignmentChip({ alignment, size = 'sm' }) {
  if (!alignment) return null
  const isSm = size === 'sm'
  // Hearth idiom: the shared .chip pill (gold accent border + mono code).
  // We keep the mono family + tight tracking for the 2-letter code, and
  // scale the padding/size for the two call sizes (inline prompt chip vs.
  // the larger alignment-field selector).
  return (
    <span
      className="chip"
      title={ALIGNMENT_NAMES[alignment] || alignment}
      style={{
        fontFamily: 'var(--mono)',
        fontSize: isSm ? 10 : 12,
        fontWeight: 600,
        letterSpacing: '0.06em',
        padding: isSm ? '2px 7px' : '4px 10px',
        borderColor: 'color-mix(in oklab, var(--accent) 38%, var(--rule))',
        color: 'var(--accent)',
        verticalAlign: 'middle',
        userSelect: 'none'
      }}
    >
      {alignment}
    </span>
  )
}

export { ALIGNMENT_NAMES, ALIGNMENT_DESCRIPTIONS }
