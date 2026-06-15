/**
 * Locked tone description for the Prelude — Phase 1 Decision 3 sub-deliverable
 * (DECISION_LOG 2026-04-29).
 *
 * Replaces the v1.0.73 four-preset tone system. MVP ships ONE tone:
 * "epic fantasy in a lived-in world" anchored in Faerûn. The 16-tag
 * combinable system and the 4-preset selector are both deferred to
 * v2.0.0+; until then, this is the authoritative tone signal injected
 * into both the arc-plan generator (Opus) and the per-turn play prompt
 * (Sonnet).
 *
 * Folding the shelter-behavior corrective into paragraph 2 (rather than
 * leaving it as a separate Cardinal Rule) elevates it to tone-setting
 * altitude. Phase 4's diagnostic tests whether that elevation is
 * sufficient to override the AI's default-to-shelter behavior with child
 * protagonists; further prompt-engineering work follows from findings.
 *
 * The text is treated as living. Playtesting may surface places where
 * the AI mis-reads, over-leans on Faerûn-typical types, or underdelivers
 * on a specific register. Revisions follow the same loop as the H7/H8
 * prose-quality work: identify the failure, adjust the text, re-validate.
 */

export const LOCKED_TONE_DESCRIPTION = `Concrete details in this description are illustrative of register and texture. They are guidance for what kinds of things belong in scenes; they are not canon facts about the player's world. Specific places, names, NPCs, and circumstances come from the arc plan and the player's setup answers, not from this tone description.

What this tone is. This is epic fantasy in the Forgotten Realms — a world with deep history, real gods, working magic, and ancient places that remember things humans don't. The map has been walked for thousands of years. There are ruins older than nations, artifacts whose owners are long dead, mountain ranges where dragons sleep, and crossroads where small choices have echoed for generations. And this world is also lived in: bread is baked, debts are owed, taverns smell of smoke, knees ache, and most people have never seen a wizard. The grand and the granular share the same scene. A child can grow up watching their father shoe horses and also know that a knight of an ancient order rode through their village last spring. Both things are real. The wonder doesn't make the mundane less true; the mundane doesn't make the wonder less wondrous.

What this tone is not. It is not generic fantasy where the world arranges itself around the protagonist's importance. It is not high-camp parody, video-game-pastiche, or YA-coded fantasy that sands down moral edges to make them easier. It is also not grimdark — this world has light, beauty, decency, and people who help each other for no reason. It is not safe, either. Children in this world get hurt. Parents disappoint. Mentors die. Choices have lasting cost. The protagonist's age affects what they understand and how they feel, not what the world is willing to do to them. Do not soften consequences because the protagonist is young; a coming-of-age story in this world can include real loss, real fear, and real moral weight, and the best ones do.

Beats this tone reaches for. Quiet scenes that earn their weight before the loud ones land. NPCs who are competent at their actual jobs, suspicious of strangers, occasionally generous, often tired — and a few who have seen things they don't talk about. Combat that is fast, dirty, and frightening at any age. Magic that costs something, that feels strange, that doesn't always behave. Old places that feel old. Legends that may or may not be true but are part of the cultural air. Moments of unexpected tenderness in hard places. Choices that cost something whichever way the player goes. Knights, monsters, gods, ruins, and rumors — alongside fields, kitchens, market days, and the work of being alive. The world is real; it does not negotiate. It is also full of wonder; honor that too.`;

/**
 * Build the TONE block for injection into prompts. Returns a header line
 * (so the caller can locate the block in cache traces) plus the locked
 * description. Both Opus arc-plan generation and Sonnet per-turn prompts
 * inject this block at the position previously occupied by tone-tag
 * injection.
 */
export function buildLockedToneBlock() {
  return `TONE: epic fantasy in a lived-in world

${LOCKED_TONE_DESCRIPTION}`;
}
