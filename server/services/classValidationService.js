// server/services/classValidationService.js — creator-next Stage 2
// (2026-11-04, overnight Stage 2 build).
//
// Pure class/subclass validation against the SERVER registries.
// No database imports: the subclass registry is pure data lookups
// (subclassService), and the class list below mirrors exactly the
// classes that registry covers.
//
// REGISTRY SCOPE, stated honestly (verified 2026-11-04,
// corrected 2026-11-08):
// - The subclass registry (subclassService SUBCLASSES_BY_CLASS)
//   covers 12 classes: barbarian, bard, cleric, druid, fighter,
//   monk, paladin, ranger, rogue, sorcerer, warlock, wizard.
//   There is NO server class-chassis registry in this mirror:
//   classes.json is a CLIENT file, so it is not imported here.
// - 'artificer' is a valid base class (wired 2026-11-04) but has
//   NO subclass registry entry (listSubclasses('artificer') is []),
//   so any artificer subclassId is UNVERIFIABLE here, not valid.
//   The client classes.json artificer list (which still carries
//   unverified Forgewright/Warsmith and omits Cartographer) is
//   therefore never treated as registry truth by this service.
// - Homebrew classes.json classes with no server registry
//   (keeper, pugilist) are reported as outside the server
//   registry, not as "invalid classes" in general — the
//   distinction matters because the shared POST route
//   historically accepts any class string. Warlord left this
//   list 2026-11-06 (gaps-batch item 8b): its 8 Presences are
//   server-registered, so a warlord subclass is verifiable
//   here now. Blood Hunter left it the same day: its 4 Orders
//   are indexed in subclassService.js, so it is a KNOWN_CLASS.
//   The overnight-build classes (spellshot, warden, magus,
//   scholar, duelist, blackguard) are KNOWN_CLASSES too — the
//   "12 classes" line above counts only the subclass registry's
//   original PHB twelve, not the full known-class list.
//
// validateClassSubclass({ classId, subclassId }) returns
// { ok, errors } where every error names the offending field
// ('classId' or 'subclassId') first, so the UI can point at it.
// A valid pair also returns { entry } (registry name,
// selectionLevel, origin) for the caller's display use.

import { listSubclasses, getSubclass } from './subclassService.js';

export const REGISTRY_CLASSES = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
];

// Base classes the server knows: the 12 registry classes plus the
// wired Artificer base class (subclasses unverifiable, see header)
// plus the 7 overnight-build base classes (spellshot, warden, magus,
// pugilist, scholar, duelist, blackguard), whose subclasses are indexed
// in subclassService.js by the same merge, plus warlord (2026-11-06,
// gaps-batch item 8b — 8 KibblesTasty v1.5 Presences indexed).
// Blood Hunter (2026-11-06): base class + 4 registered Orders — a
// KNOWN_CLASS like the overnight classes, not a client-only class.
export const NEW_BASE_CLASSES = ['spellshot', 'warden', 'magus', 'pugilist', 'scholar', 'duelist', 'blackguard', 'warlord'];
export const KNOWN_CLASSES = [...REGISTRY_CLASSES, 'artificer', ...NEW_BASE_CLASSES, 'blood_hunter'];

// MVP player-class scope (Zach, 2026-11-08): Magus, Blackguard and
// Scholar are GRAYED OUT, not removed. They stay in the registry
// (NPCs/companions can still be them) and are only disabled for
// player characters. Reversible by design: putting a class back is
// deleting one line here. The flag is game policy, so it lives in
// this service layer, never in the book data files — mirroring
// MVP_DEFERRED_SPECIES in speciesService.js.
export const MVP_DEFERRED_CLASSES = new Set(['magus', 'blackguard', 'scholar']);

export const MVP_DEFERRED_CLASS_NOTE = 'Coming after the MVP — NPCs can still be this class.';

/**
 * Is this class pick creatable as a player character in the MVP?
 * Unknown classes stay creatable — the v1 no-rejection rule
 * (character.js has historically accepted any class string);
 * only known deferred classes refuse.
 */
export function isClassPcCreatable(classId) {
  const cls = String(classId || '').trim().toLowerCase();
  if (!cls) return true;
  return !MVP_DEFERRED_CLASSES.has(cls);
}

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateClassSubclass({ classId = null, subclassId = null } = {}) {
  const errors = [];
  const cls = norm(classId);
  const sub = String(subclassId || '').trim();

  if (!cls) {
    errors.push('classId: no class selected');
    return { ok: false, errors };
  }
  if (!KNOWN_CLASSES.includes(cls)) {
    errors.push(`classId: '${classId}' is not a known class (known classes: ${REGISTRY_CLASSES.join(', ')}, plus artificer base and ${NEW_BASE_CLASSES.join(', ')})`);
    return { ok: false, errors };
  }
  if (!sub) {
    errors.push('subclassId: no subclass selected');
    return { ok: false, errors };
  }
  if (cls === 'artificer') {
    errors.push(`subclassId: '${subclassId}' cannot be verified — artificer has no subclass list yet`);
    return { ok: false, errors };
  }
  const entry = getSubclass(cls, sub);
  if (!entry) {
    const known = listSubclasses(cls).map(s => s.name).join(', ');
    errors.push(`subclassId: '${subclassId}' is not a ${cls} subclass (known ${cls} subclasses: ${known})`);
    return { ok: false, errors };
  }
  return {
    ok: true,
    errors: [],
    entry: {
      name: entry.name,
      key: entry.key,
      class: entry.class,
      selectionLevel: entry.selectionLevel,
      source: entry.source,
      origin_setting: entry.origin_setting,
      origin_region: entry.origin_region,
    },
  };
}

export default { validateClassSubclass, REGISTRY_CLASSES, KNOWN_CLASSES, MVP_DEFERRED_CLASSES, MVP_DEFERRED_CLASS_NOTE, isClassPcCreatable };
