/**
 * Phase B mechanical-spine handler test (2026-06-05).
 * Drives processResponseMarkers with a crafted narrative (the AI is
 * non-deterministic) and asserts the handlers persist real state:
 *   HP_CHANGE → characters.current_hp
 *   EFFECT_START/END → session_config.activeEffects (+ concentration rule)
 *   TURN → session_config.combat
 *   ROLL_REQUEST → returns the player's preloaded modifier
 * Uses TEST_-prefixed rows, cleaned up at the end.
 */
import { dbGet, dbRun } from '../server/database.js';
import { processResponseMarkers } from '../server/services/markerPipeline.js';
import '../server/services/gameStateMarkerService.js'; // registers handlers

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

async function run() {
  // --- setup: TEST character (hp 20/20, dex 16 → +3) + session ---
  const charRes = await dbRun(
    `INSERT INTO characters (name, class, level, current_hp, max_hp, armor_class, ability_scores, current_location, experience_to_next_level, creation_phase)
     VALUES ('TEST_SpineHero', 'fighter', 3, 20, 20, 16, ?, 'Test Arena', 0, 'active')`,
    [JSON.stringify({ str: 14, dex: 16, con: 14, int: 10, wis: 12, cha: 8 })]
  );
  const characterId = Number(charRes.lastInsertRowid);

  const sessRes = await dbRun(
    `INSERT INTO dm_sessions (character_id, title, status, messages, session_config)
     VALUES (?, 'TEST_SpineSession', 'active', '[]', '{}')`,
    [characterId]
  );
  const sessionId = Number(sessRes.lastInsertRowid);

  try {
    // --- turn 1: damage + concentration effect + turn marker ---
    const narrative1 = `The arrow bites deep. [HP_CHANGE: Target="Player" Delta=-5 Reason="arrow"] ` +
      `You whisper a prayer and golden light settles over you. [EFFECT_START: Name="Bless" Concentration=true Duration="1 minute" Source="cleric"] ` +
      `The goblin snarls and steps up. [TURN: Combatant="Goblin" Round=2]`;
    await processResponseMarkers(narrative1, { characterId, sessionId, narrative: narrative1 });

    let char = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [characterId]);
    check('HP_CHANGE applied (-5): 20 → 15', char.current_hp === 15);

    let cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config);
    check('EFFECT_START persisted Bless', (cfg.activeEffects || []).some(e => e.name === 'Bless' && e.concentration === true));
    check('TURN persisted {Goblin, round 2}', cfg.combat?.currentTurn === 'Goblin' && cfg.combat?.round === 2);

    // --- turn 2: a second concentration effect ends the first (5e rule) ---
    const narrative2 = `You shift your focus to the hunt. [EFFECT_START: Name="Hunter's Mark" Concentration=true Duration="1 hour"]`;
    await processResponseMarkers(narrative2, { characterId, sessionId, narrative: narrative2 });
    cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config);
    const concEffects = (cfg.activeEffects || []).filter(e => e.concentration);
    check('single-concentration rule: Bless dropped, Hunter\'s Mark active', concEffects.length === 1 && concEffects[0].name === "Hunter's Mark");

    // --- turn 3: heal + effect end ---
    const narrative3 = `Warmth floods back. [HP_CHANGE: Target="Player" Delta=8 Reason="cure wounds"] The mark fades. [EFFECT_END: Name="Hunter's Mark"]`;
    await processResponseMarkers(narrative3, { characterId, sessionId, narrative: narrative3 });
    char = await dbGet('SELECT current_hp, max_hp FROM characters WHERE id = ?', [characterId]);
    check('HP_CHANGE heal (+8) clamps at max: 15 → 20 (not 23)', char.current_hp === 20);
    cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config);
    check('EFFECT_END removed Hunter\'s Mark', !(cfg.activeEffects || []).some(e => e.name === "Hunter's Mark"));

    // --- turn 4: ROLL_REQUEST returns the player's dex modifier (+3) ---
    const narrative4 = `A blade swings from the dark — react fast! [ROLL_REQUEST: Kind=save Ability=dex DC=15 Label="Dodge"]`;
    const r4 = await processResponseMarkers(narrative4, { characterId, sessionId, narrative: narrative4 });
    const rr = r4.handlerResults.find(h => h.schemaKey === 'ROLL_REQUEST')?.result;
    check('ROLL_REQUEST preloads dex modifier +3, dc 15', rr && rr.modifier === 3 && rr.dc === 15 && rr.kind === 'save');
  } finally {
    // --- cleanup ---
    await dbRun('DELETE FROM dm_sessions WHERE id = ?', [sessionId]);
    await dbRun('DELETE FROM characters WHERE id = ?', [characterId]);
  }

  console.log(`\nPhase B spine: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
