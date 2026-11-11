// server/routes/spells.js — spell-picker read API (Stage 4, 2026-11-06).
//
// GET /api/spells?class=<classId>&level=1&subclass=<name>&abilityMod=<n>
//   -> { classId, level, cantripsKnown, spellsKnown, spellsPrepared,
//         spellcastingAbility, alwaysPrepared, spells: [{ key, name, level, school,
//         classes, description }] }
//
// Always-prepared (mechanics hooks Family 3, 2026-11-09): the
// `alwaysPrepared` array lists the spells the character's subclass
// has always prepared at this level, computed from the SAME subclass
// helpers the PUT/level-up validators use — never a second list.
// "Always prepared" and "added to the list" are different gates and
// must never be conflated: warlock patron spells are added-to-list
// (choosable, but they still cost a prepared slot), so the warlock
// arm returns only Contact Other Plane at 9th+ (the class-level
// grant), never the patron list. Optional query params feed the
// stored-choice helpers: &landType=<arid|polar|temperate|tropical>
// for Circle of the Land (absent -> [] for Land, fail-closed, no
// default land) and &patron=<name> for Profane Soul (absent -> []).
// Wizard returns [] here: Spell Mastery / Signature Spells picks
// are per-character spellbook state, not derivable from class +
// level + subclass on this stateless route.
//
// The spell list is the catalog entries that pass canLearnSpell at
// that level for that class (and subclass, when one applies), with
// level-0 spells (cantrips) EXCLUDED — cantrips are Stage 2's
// territory; this route lists leveled picks only. Sorted by level,
// then name.
//
// Cantrip mode (Stage 6 follow-up, 2026-11-07):
// GET /api/spells?class=<classId>&level=0[&subclass=<name>] lists
// ONLY the level-0 entries that pass canLearnSpell for that class
// (and subclass) — the choosable cantrip list for the creator's
// Stage 2 picker. The counts in the envelope are the LEVEL-1
// creator counts (cantripsKnown is the L1 pick count —
// getCantripsKnown at level 0 would read row[-1], i.e. 0 — while
// `level` echoes the requested 0). canLearnSpell is called at
// character level 1: a magus with no society gets an empty list
// (its spells are society-gated, so there is no list to offer
// until a society is picked); a magus WITH a society gets that
// society's cantrips. A non-caster (paladin, ranger, fighter
// without Eldritch Knight) gets an empty list with cantripsKnown 0.
//
// spellsKnown is getSpellsKnown (a number for known-casters, null
// for prepared casters). spellsPrepared is getSpellsPrepared with
// the abilityMod query param (default 0 when no scores are
// supplied): the client computes the real prepared count from its
// final ability scores — this route's number with abilityMod 0 is
// the mod-0 floor, not the character's count. spellcastingAbility
// resolves through spellcastingAbilityFor, so a magus without a
// society (or a warden/scholar without a casting subclass) reports
// null — the ability is subclass-dependent and unknown.
//
// Read-only: no creation, no mutation. Mounted in server/index.js
// next to the themes route.
import express from 'express';
import { SPELL_DATA_ENTRIES } from '../data/spellCatalogData.js';
import { canLearnSpell } from '../services/spellSelectionService.js';
import { KNOWN_CLASSES } from '../services/classValidationService.js';
import { spellbookSizeForLevel } from '../services/spellbookService.js';
import {
  artificerSubclassSpellsAtLevel,
  blackguardViceSpellsAtLevel,
  paladinOathSpellsAtLevel,
  sorcererSubclassSpellsAtLevel,
  bardSubclassSpellsAtLevel,
  eldritchKnightSpellsAtLevel,
  arcaneTricksterSpellsAtLevel,
  profaneSoulArcanaSpellsAtLevel,
  clericDomainSpellsAtLevel,
  druidCircleSpellsAtLevel,
} from '../services/subclassService.js';
import { rangerAlwaysPreparedSpells } from '../services/rangerService.js';
import { warlockAlwaysPreparedSpells } from '../services/warlockService.js';
import {
  getCantripsKnown,
  getSpellsKnown,
  getSpellsPrepared,
  spellcastingAbilityFor,
} from '../config/levelProgression.js';

// Classes the creator offers whose subclasses are not
// server-registered (blood_hunter, warlord: subclassLevel 3;
// keeper: 6). Same extension as CREATOR_NEXT_KNOWN_CLASSES in
// routes/character.js: Stage 2 never collects a subclass for them,
// and this route must still answer for them (with an empty list —
// none of the three can pick spells at level 1).
const SPELL_ROUTE_KNOWN_CLASSES = new Set([...KNOWN_CLASSES, 'blood_hunter', 'keeper', 'warlord']);

function titleCaseSpellKey(key) {
  return String(key || '')
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// Always-prepared spells for the queried class/subclass/level — see
// the header. One dispatch over the same helpers the validators
// use; a class with no always-prepared list returns [].
function alwaysPreparedFor({ classId, level, subclass, landType, patron }) {
  const lvl = Number(level) || 0;
  // Warlock Contact Other Plane is a class-level grant (L9+), not a
  // subclass list — it applies with or without a subclass, and the
  // patron list is deliberately never consulted here.
  if (classId === 'warlock') return warlockAlwaysPreparedSpells(lvl);
  if (!subclass) return [];
  switch (classId) {
    case 'cleric': return clericDomainSpellsAtLevel('cleric', subclass, lvl);
    case 'druid': return druidCircleSpellsAtLevel('druid', subclass, lvl, landType ?? null);
    case 'paladin': return paladinOathSpellsAtLevel('paladin', subclass, lvl);
    case 'sorcerer': return sorcererSubclassSpellsAtLevel('sorcerer', subclass, lvl);
    case 'bard': return bardSubclassSpellsAtLevel('bard', subclass, lvl);
    case 'blackguard': return blackguardViceSpellsAtLevel('blackguard', subclass, lvl);
    case 'artificer': return artificerSubclassSpellsAtLevel('artificer', subclass, lvl);
    case 'ranger': return rangerAlwaysPreparedSpells(subclass, lvl);
    case 'fighter': return eldritchKnightSpellsAtLevel('fighter', subclass, lvl);
    case 'rogue': return arcaneTricksterSpellsAtLevel('rogue', subclass, lvl);
    case 'blood_hunter': return profaneSoulArcanaSpellsAtLevel('blood_hunter', subclass, lvl, patron ?? null);
    default: return [];
  }
}

const router = express.Router();

router.get('/', (req, res) => {
  const rawClass = req.query.class ?? req.query.classId ?? null;
  if (rawClass == null || String(rawClass).trim() === '') {
    return res.status(400).json({ error: 'class query parameter is required (e.g. ?class=wizard&level=1)' });
  }
  const classId = String(rawClass).trim().toLowerCase();
  if (!SPELL_ROUTE_KNOWN_CLASSES.has(classId)) {
    return res.status(400).json({ error: `Unknown class: '${rawClass}'` });
  }
  const levelRaw = req.query.level ?? '1';
  const level = Number(levelRaw);
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    return res.status(400).json({ error: `level '${levelRaw}' is not a valid character level (0-20; 0 lists cantrips)` });
  }
  const isCantripMode = level === 0;
  // Counts are the level-1 creator counts in cantrip mode (see the
  // header: getCantripsKnown at level 0 would read row[-1]).
  // canLearnSpell likewise takes the character level, 1.
  const countLevel = isCantripMode ? 1 : level;
  const subclass = req.query.subclass != null && String(req.query.subclass).trim() !== ''
    ? String(req.query.subclass).trim()
    : null;
  // Stored-choice params for the always-prepared dispatch (see the
  // header): Land druid land type, Profane Soul patron. Absent or
  // blank -> null, and the helpers fail closed (no exclusion).
  const landTypeRaw = req.query.landType ?? req.query.land_type ?? null;
  const landType = landTypeRaw != null && String(landTypeRaw).trim() !== ''
    ? String(landTypeRaw).trim()
    : null;
  const patronRaw = req.query.patron ?? null;
  const patron = patronRaw != null && String(patronRaw).trim() !== ''
    ? String(patronRaw).trim()
    : null;
  const abilityModRaw = req.query.abilityMod ?? req.query.ability_mod ?? null;
  const abilityMod = abilityModRaw == null || abilityModRaw === ''
    ? 0
    : Number(abilityModRaw);
  if (!Number.isFinite(abilityMod)) {
    return res.status(400).json({ error: `abilityMod '${abilityModRaw}' is not a number` });
  }

  const spells = [];
  for (const [key, entry] of Object.entries(SPELL_DATA_ENTRIES)) {
    if (isCantripMode) {
      if (!entry || Number(entry.level) !== 0) continue; // cantrips only
    } else {
      if (!entry || Number(entry.level) <= 0) continue; // cantrips excluded
    }
    const result = canLearnSpell({ classId, level: countLevel, spellName: key, subclass });
    if (!result.ok) continue;
    spells.push({
      key,
      name: titleCaseSpellKey(key),
      level: Number(entry.level),
      school: entry.school || null,
      classes: entry.classes || [],
      description: entry.description || '',
    });
  }
  spells.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  return res.json({
    classId,
    level,
    cantripsKnown: getCantripsKnown(classId, countLevel, subclass),
    spellsKnown: getSpellsKnown(classId, countLevel, subclass),
    spellsPrepared: getSpellsPrepared(classId, countLevel, Math.trunc(abilityMod), subclass),
    // Spellbook size (wizard only, 2026-11-07): 6 at L1, +2 per
    // wizard level after 1st. spellsKnown stays null for wizard —
    // the client uses null to mean "prepared caster" — so the book
    // count rides its own field, never a repurposed one.
    spellbookSize: classId === 'wizard' ? spellbookSizeForLevel(countLevel) : null,
    spellcastingAbility: spellcastingAbilityFor(classId, subclass),
    // Always-prepared spells for this class/subclass/level (Family
    // 3) — same helpers as the validators; [] when none apply.
    alwaysPrepared: alwaysPreparedFor({ classId, level: countLevel, subclass, landType, patron }),
    spells,
  });
});

export default router;
