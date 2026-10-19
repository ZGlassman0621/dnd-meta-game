/**
 * Spell Cast Service (Combat Pipeline #3).
 * Server-side spell slot tracking. AI emits SPELL_CAST; server validates and decrements.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { lookupSpell, isConcentrationSpell } from '../data/spellCatalog.js';

export async function castSpell(characterId, spellName, level) {
  if (!characterId) return null;
  const lvl = Math.trunc(level) || 0;
  if (lvl === 0) {
    return { type: 'spell_cast', spell: spellName, level: 0, slotConsumed: false, success: true };
  }
  const char = await dbGet('SELECT spell_slots, spell_slots_used FROM characters WHERE id = ?', [characterId]);
  if (!char) return null;
  const maxSlots = safeParse(char.spell_slots, {});
  const usedSlots = safeParse(char.spell_slots_used, {});
  const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
  const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
  if (used >= max) {
    return { type: 'spell_cast', spell: spellName, level: lvl, slotConsumed: false, success: false, reason: 'no_slots_available', slotsMax: max, slotsUsed: used };
  }
  usedSlots[String(lvl)] = used + 1;
  await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify(usedSlots), characterId]);

  // Combat Pipeline #12: Auto-start concentration for concentration spells
  // (Structural integration with #4: concentrationService)
  let concentrationStarted = false;
  if (isConcentrationSpell(spellName)) {
    try {
      const { startConcentration } = await import('./concentrationService.js');
      await startConcentration(characterId, spellName);
      concentrationStarted = true;
    } catch (e) { console.error('[spellCastService] Auto-concentration failed:', e.message); }
  }

  const spellInfo = lookupSpell(spellName);
  return {
    type: 'spell_cast',
    spell: spellName,
    level: lvl,
    slotConsumed: true,
    success: true,
    slotsMax: max,
    slotsUsed: used + 1,
    slotsRemaining: max - (used + 1),
    concentration: concentrationStarted,
    castTime: spellInfo?.castTime || 'action',
    components: spellInfo?.components || [],
  };
}

registerMarkerHandler('SPELL_CAST', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const spell = parsed?.Spell;
    const level = Number(parsed?.Level) || 0;
    if (!spell) return null;
    return await castSpell(context.characterId, spell, level);
  } catch (e) {
    console.error('[spellCastService] SPELL_CAST handler failed:', e.message);
    return null;
  }
});

export default { castSpell };
