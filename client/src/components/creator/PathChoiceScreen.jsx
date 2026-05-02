import { Eyebrow } from './creatorPrimitives.jsx'

/**
 * Screen 2 — Path choice. Per PHASE_2_CREATOR_SPEC.md §4.
 *
 * Two co-equal cards (Prelude on the left, Campaign on the right). The
 * player picks how to bring the character into the world: through played
 * formative-years fiction (Prelude) or through direct authoring
 * (Campaign).
 *
 * Per spec §4.2: "The two cards are visually equivalent in weight —
 * same size, same hierarchy. Neither is 'the recommended' path. The
 * framing line and card body copy together convey what's gained and
 * lost in each choice; the player decides."
 *
 * Per spec §4.7 (voice notes): pre-fiction screen, operational language
 * acceptable. Drafted body copy mixes operational ("eight steps to a
 * complete person") with light in-fiction ("by the time the road begins,
 * the character is already someone with history"). Voice register
 * preserved verbatim from spec.
 */
export default function PathChoiceScreen({ onPrelude, onCampaign, onBack }) {
  return (
    <div className="frame wide pathframe">
      <Eyebrow>A choice of beginnings</Eyebrow>
      <p className="lede" style={{ margin: '20px auto 48px', maxWidth: 760 }}>
        Your character will be played across years of their life. Choose how to bring them into the world:
      </p>

      <div className="pathcards">
        {/* Card 1 — Prelude (left). Per spec §4.4. */}
        <button type="button" className="pathcard" onClick={onPrelude}>
          <Eyebrow>Path I</Eyebrow>
          <h2>Create a Prelude Character</h2>
          <p>
            Play through your character's formative years before you reach the campaign. Four sessions follow them from childhood to the threshold of adulthood, where decisions you make in fiction shape who they become — their class, their theme, their heritage gift, and the moments their stats grew sharper. By the time the road begins, the character is already someone with history.
          </p>
          <p>
            The Prelude takes longer to play than building a character directly. In return, your character earns small mechanical advantages: stat bumps from formative moments, a meaningful object or two carried into adventure, established places and people from their past that can return in the campaign. These are the gameplay bonuses of having actually lived your character before playing them.
          </p>
          <div className="cta">Begin a Prelude <span className="arrow">→</span></div>
        </button>

        {/* Card 2 — Campaign (right). Per spec §4.5. */}
        <button type="button" className="pathcard" onClick={onCampaign}>
          <Eyebrow>Path II</Eyebrow>
          <h2>Create a Campaign Character</h2>
          <p>
            Build your character directly. Eight steps to a complete person — name, ancestry, calling, abilities, gear — ready to step into their first adventure. You author whatever depth your character has: as much or as little personality, history, and detail as you want.
          </p>
          <p>
            This path is faster than the Prelude. Your character begins the campaign without the small mechanical advantages a Prelude character earns, and without the established past that emerges from played fiction. They begin as a complete person on their own terms.
          </p>
          <div className="cta">Build directly <span className="arrow">→</span></div>
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <button type="button" className="btn ghost" onClick={onBack}>← Back to roster</button>
      </div>
    </div>
  )
}
