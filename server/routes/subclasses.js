// server/routes/subclasses.js — subclass registry read API (Additional Subclasses batch).
//
// GET /api/subclasses        -> every indexed class, grouped by class
// GET /api/subclasses/:class -> one class's entries, or 404 when that class
//                                is not indexed in subclassService.js
// Read-only: no creation, no mutation. Entries are served verbatim from
// the registry, including each entry's `choices` and whatever cantrip-grant
// fields exist as-is (e.g. mechanics.cantrip prompt text). No structured
// cantrip field is invented here: none exists in the registry today.
// KNOWN_CLASSES mirrors subclassService.js SUBCLASSES_BY_CLASS; a class
// with no index line is not yet in the registry and correctly 404s here.
import express from 'express';
import { listSubclasses } from '../services/subclassService.js';

const router = express.Router();

// Classes indexed in subclassService.js SUBCLASSES_BY_CLASS as of the
// overnight 7-class merge: the 12 pre-existing classes plus artificer
// plus spellshot, warden, magus, pugilist, scholar, duelist, blackguard,
// plus warlord (2026-11-06, gaps-batch item 8b: 8 KibblesTasty v1.5
// Presences), plus blood_hunter (2026-11-06: 4 Orders from the GM Binder
// 2024 conversion).
const KNOWN_CLASSES = [
  'artificer',
  'barbarian',
  'bard',
  'blackguard',
  'blood_hunter',
  'cleric',
  'druid',
  'duelist',
  'fighter',
  'magus',
  'monk',
  'paladin',
  'pugilist',
  'ranger',
  'rogue',
  'scholar',
  'sorcerer',
  'spellshot',
  'warden',
  'warlock',
  'warlord',
  'wizard',
];

router.get('/', (_req, res) => {
  const subclassesByClass = {};
  for (const className of KNOWN_CLASSES) {
    subclassesByClass[className] = listSubclasses(className);
  }
  res.json({ subclassesByClass });
});

router.get('/:class', (req, res) => {
  const className = String(req.params.class || '').toLowerCase().trim();
  if (!KNOWN_CLASSES.includes(className)) {
    return res.status(404).json({ error: `Unknown subclass class: ${req.params.class}` });
  }
  res.json({ class: className, subclasses: listSubclasses(className) });
});

export default router;
