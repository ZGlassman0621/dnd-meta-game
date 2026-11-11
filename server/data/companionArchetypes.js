/**
 * companionArchetypes.js — build archetypes for class-based companions and
 * adventuring-stock NPCs (DM System, designed with Zach 2026-10-21).
 *
 * A class template is a good generic build. An archetype is the same class
 * built around a different center of gravity — the INT rogue, the STR
 * wizard, the DEX warlock — and it is also a PERSON: each build carries
 * personification guidance the DM plays (how this build thinks, works,
 * and shows up in a scene).
 *
 * Rolled by the system, weighted: template 50, signature off-build ~15-25,
 * the rest split. Hidden from the player; discovered through play.
 *
 * The 'template' build for each class mirrors companionSheetService's
 * class priorities and default skills exactly — a test pins that, so the
 * two can never drift apart.
 *
 * priorities: the six ability keys, highest first (standard array
 * 15/14/13/12/10/8 is assigned in that order). skills: the trained set.
 */
import { roll } from '../utils/rng.js';

export const ARCHETYPES = {
  rogue: [
    { key: 'template', label: 'Template Rogue', weight: 50, priorities: ['dex', 'int', 'con', 'cha', 'wis', 'str'], skills: ['Stealth', 'Sleight of Hand', 'Perception', 'Investigation'], guidance: 'A professional: quick hands, quicker exits. Sizes up every room for valuables and escape routes alike.' },
    { key: 'int', label: 'The Locksmith Scholar', weight: 15, priorities: ['int', 'dex', 'con', 'wis', 'cha', 'str'], skills: ['Investigation', 'Sleight of Hand', 'Arcana', 'Perception'], guidance: 'Solves problems with research and mechanisms. Notices inconsistencies others miss. Underplays physical risk — prefers a plan to a scramble, and says so.' },
    { key: 'cha', label: 'The Face', weight: 12, priorities: ['cha', 'dex', 'con', 'int', 'wis', 'str'], skills: ['Deception', 'Persuasion', 'Insight', 'Stealth'], guidance: 'Talks first, steals second. Reads people the way others read ledgers. Uncomfortable in silence; fills it, charmingly.' },
    { key: 'con', label: 'The Survivor', weight: 12, priorities: ['con', 'dex', 'str', 'wis', 'int', 'cha'], skills: ['Athletics', 'Stealth', 'Perception', 'Survival'], guidance: 'Endures. Laconic, hard to rattle, drinks anyone under the table. Waits problems out; has buried cleverer people.' },
    { key: 'wis', label: 'The Watcher', weight: 11, priorities: ['wis', 'dex', 'con', 'int', 'cha', 'str'], skills: ['Perception', 'Insight', 'Stealth', 'Investigation'], guidance: 'Quiet, watches exits and hands. Speaks in observations, not opinions. Knows when a room is lying.' }
  ],
  wizard: [
    { key: 'template', label: 'Template Wizard', weight: 50, priorities: ['int', 'con', 'dex', 'wis', 'cha', 'str'], skills: ['Arcana', 'History'], guidance: 'A scholar first: methodical, curious, mildly annoyed by improvisation.' },
    { key: 'str', label: 'The Laborer-Scholar', weight: 18, priorities: ['str', 'int', 'con', 'dex', 'wis', 'cha'], skills: ['Athletics', 'Arcana'], guidance: 'A laborer\'s hands and a scholar\'s mind. Intimidates accidentally. Trusts what can be lifted, built, or broken over what can be argued.' },
    { key: 'con', label: 'The Iron Mind', weight: 16, priorities: ['con', 'int', 'dex', 'wis', 'str', 'cha'], skills: ['Arcana', 'Investigation'], guidance: 'Indefatigable. Works through the night, the fever, the siege. Concentration like a held breath that never releases.' },
    { key: 'cha', label: 'The Court Mage', weight: 16, priorities: ['cha', 'int', 'con', 'dex', 'wis', 'str'], skills: ['Persuasion', 'Arcana'], guidance: 'Magic as statecraft. Every spell is also a statement; every consultation, a negotiation.' }
  ],
  warlock: [
    { key: 'template', label: 'Template Warlock', weight: 50, priorities: ['cha', 'con', 'dex', 'wis', 'int', 'str'], skills: ['Arcana', 'Deception'], guidance: 'Charming on the surface, transactional underneath. Everything is a bargain; everyone has a price, including them.' },
    { key: 'dex', label: 'The Shadowblade', weight: 20, priorities: ['dex', 'cha', 'con', 'int', 'wis', 'str'], skills: ['Stealth', 'Deception'], guidance: 'The pact bought reflexes and silence. Speaks softly, moves first, vanishes rather than explains.' },
    { key: 'int', label: 'The Occultist', weight: 15, priorities: ['int', 'cha', 'con', 'dex', 'wis', 'str'], skills: ['Arcana', 'Investigation'], guidance: 'Treats the patron as a research subject. Keeps notes on the entity that owns their soul, which unsettles everyone including the patron.' },
    { key: 'wis', label: 'The Dreamer', weight: 15, priorities: ['wis', 'cha', 'con', 'int', 'dex', 'str'], skills: ['Insight', 'Religion'], guidance: 'Listens to things that are not in the room. Gentle, distracted, occasionally terrifyingly accurate.' }
  ],
  fighter: [
    { key: 'template', label: 'Template Fighter', weight: 50, priorities: ['str', 'con', 'dex', 'wis', 'int', 'cha'], skills: ['Athletics', 'Perception'], guidance: 'A soldier\'s economy: few words, maintained gear, opinions about ground and weather.' },
    { key: 'dex', label: 'The Duelist', weight: 20, priorities: ['dex', 'con', 'str', 'int', 'wis', 'cha'], skills: ['Acrobatics', 'Perception'], guidance: 'Precision as pride. Treats every fight as a performance review — their own. Politely contemptuous of brawlers.' },
    { key: 'int', label: 'The Tactician', weight: 15, priorities: ['int', 'str', 'con', 'dex', 'wis', 'cha'], skills: ['History', 'Athletics'], guidance: 'Fights the battle three moves early. Quotes campaigns the way priests quote scripture.' },
    { key: 'cha', label: 'The Banneret', weight: 15, priorities: ['cha', 'str', 'con', 'dex', 'wis', 'int'], skills: ['Persuasion', 'Athletics'], guidance: 'Leads from the front because people follow. Believes morale is a weapon and maintains it like one.' }
  ],
  ranger: [
    { key: 'template', label: 'Template Ranger', weight: 50, priorities: ['dex', 'wis', 'con', 'str', 'int', 'cha'], skills: ['Stealth', 'Perception', 'Survival'], guidance: 'Patient, track-obsessed, quiet. More comfortable under sky than roof; judges people by how they treat animals and trails.' },
    { key: 'str', label: 'The Bruiser', weight: 18, priorities: ['str', 'dex', 'con', 'wis', 'int', 'cha'], skills: ['Athletics', 'Survival', 'Perception'], guidance: 'A warden who settles things physically. The wild is not a cathedral to them; it is a workplace, and they are its foreman.' },
    { key: 'con', label: 'The Enduring', weight: 16, priorities: ['con', 'dex', 'wis', 'str', 'cha', 'int'], skills: ['Survival', 'Perception', 'Athletics'], guidance: 'Outlasts. Weather, hunger, pursuit — all temporary. Has walked out of country that killed better-equipped parties.' },
    { key: 'int', label: 'The Wild Scholar', weight: 16, priorities: ['int', 'dex', 'wis', 'con', 'str', 'cha'], skills: ['Nature', 'Investigation', 'Perception'], guidance: 'Names every plant twice — common and Latin. The wilderness is a text; most people are illiterate in it.' }
  ],
  cleric: [
    { key: 'template', label: 'Template Cleric', weight: 50, priorities: ['wis', 'str', 'con', 'cha', 'dex', 'int'], skills: ['Religion', 'Insight'], guidance: 'Faith as daily practice, not performance. Steady hands, steadier convictions.' },
    { key: 'cha', label: 'The Preacher', weight: 18, priorities: ['cha', 'wis', 'con', 'str', 'dex', 'int'], skills: ['Persuasion', 'Religion'], guidance: 'Every conversation is a congregation of one. Cannot help witnessing; genuinely wants to save you, specifically.' },
    { key: 'int', label: 'The Archivist', weight: 16, priorities: ['int', 'wis', 'con', 'cha', 'str', 'dex'], skills: ['History', 'Religion'], guidance: 'Serves the god by serving the record. Doctrine is a citation away and they will find it.' },
    { key: 'dex', label: 'The Penitent Blade', weight: 16, priorities: ['dex', 'wis', 'con', 'str', 'cha', 'int'], skills: ['Stealth', 'Religion'], guidance: 'Quiet devotion, quicker hands. Does the god\'s work in places the temple pretends do not exist.' }
  ],
  druid: [
    { key: 'template', label: 'Template Druid', weight: 50, priorities: ['wis', 'con', 'dex', 'int', 'cha', 'str'], skills: ['Perception', 'Survival'], guidance: 'Reads weather and animal sign the way others read faces. Civilization is a noise they tolerate in doses.' },
    { key: 'str', label: 'The Primal', weight: 18, priorities: ['str', 'wis', 'con', 'dex', 'int', 'cha'], skills: ['Athletics', 'Survival'], guidance: 'Nature is not gentle and neither are they. Settles arguments the way storms settle forests.' },
    { key: 'dex', label: 'The Thorn', weight: 16, priorities: ['dex', 'wis', 'con', 'int', 'str', 'cha'], skills: ['Stealth', 'Perception'], guidance: 'Moves like something the forest grew. Appears in conversation rather than entering it.' },
    { key: 'int', label: 'The Star-Reader', weight: 16, priorities: ['int', 'wis', 'con', 'dex', 'cha', 'str'], skills: ['Arcana', 'Nature'], guidance: 'Tracks cycles — moons, migrations, empires. Everything is a season; most people are just weather.' }
  ],
  monk: [
    { key: 'template', label: 'Template Monk', weight: 50, priorities: ['dex', 'wis', 'con', 'str', 'int', 'cha'], skills: ['Acrobatics', 'Stealth'], guidance: 'Discipline as temperament. Eats, sleeps, and speaks in measure; violence, when it comes, is punctuation.' },
    { key: 'str', label: 'The Iron Fist', weight: 18, priorities: ['str', 'dex', 'wis', 'con', 'cha', 'int'], skills: ['Athletics', 'Acrobatics'], guidance: 'The monastery\'s answer to a siege engine. Gentle in every context that does not involve a door that needs opening.' },
    { key: 'con', label: 'The Mountain', weight: 16, priorities: ['con', 'dex', 'wis', 'str', 'int', 'cha'], skills: ['Athletics', 'Insight'], guidance: 'Immovable, including emotionally. Waits out storms, sieges, and conversations with the same face.' },
    { key: 'cha', label: 'The Wandering Preacher', weight: 16, priorities: ['cha', 'dex', 'wis', 'con', 'str', 'int'], skills: ['Persuasion', 'Religion'], guidance: 'The road is the temple. Collects audiences the way other monks collect alms.' }
  ],
  paladin: [
    { key: 'template', label: 'Template Paladin', weight: 50, priorities: ['str', 'cha', 'con', 'wis', 'dex', 'int'], skills: ['Athletics', 'Persuasion'], guidance: 'The oath is not a rulebook; it is a spine. Warm to the lowly, immovable to the powerful.' },
    { key: 'dex', label: 'The Swift Oath', weight: 18, priorities: ['dex', 'str', 'cha', 'con', 'wis', 'int'], skills: ['Acrobatics', 'Athletics'], guidance: 'Swore the oath at a run and never slowed. Piety with momentum; evil gets a head start of exactly zero.' },
    { key: 'wis', label: 'The Confessor', weight: 16, priorities: ['wis', 'str', 'cha', 'con', 'dex', 'int'], skills: ['Insight', 'Religion'], guidance: 'People confess things to this face unprompted. Carries other people\'s sins more carefully than their own.' },
    { key: 'con', label: 'The Bulwark', weight: 16, priorities: ['con', 'str', 'cha', 'wis', 'dex', 'int'], skills: ['Athletics', 'Medicine'], guidance: 'Stands where standing is worst. The oath, to them, is mostly about not falling down.' }
  ],
  bard: [
    { key: 'template', label: 'Template Bard', weight: 50, priorities: ['cha', 'dex', 'con', 'wis', 'int', 'str'], skills: ['Performance', 'Persuasion', 'Deception'], guidance: 'Every room is an audience that has not been won yet. Collects stories the way misers collect coin.' },
    { key: 'int', label: 'The Lorekeeper', weight: 18, priorities: ['int', 'cha', 'dex', 'con', 'wis', 'str'], skills: ['History', 'Arcana', 'Performance'], guidance: 'The song is the footnote; the history is the point. Corrects ballads in public, kindly and at length.' },
    { key: 'wis', label: 'The Listener', weight: 16, priorities: ['wis', 'cha', 'dex', 'con', 'int', 'str'], skills: ['Insight', 'Perception', 'Performance'], guidance: 'Performs less, hears more. People leave conversations feeling fascinating and slightly exposed.' },
    { key: 'str', label: 'The Skald', weight: 16, priorities: ['str', 'cha', 'con', 'dex', 'wis', 'int'], skills: ['Athletics', 'Performance', 'Intimidation'], guidance: 'Sings the old way: loudly, armed, and standing on the table. Glory is a group activity.' }
  ],
  sorcerer: [
    { key: 'template', label: 'Template Sorcerer', weight: 50, priorities: ['cha', 'con', 'dex', 'wis', 'int', 'str'], skills: ['Arcana', 'Deception'], guidance: 'Magic as temperament: it happens around their moods. Charming, volatile, allergic to being managed.' },
    { key: 'dex', label: 'The Storm-Touched', weight: 18, priorities: ['dex', 'cha', 'con', 'wis', 'int', 'str'], skills: ['Acrobatics', 'Arcana'], guidance: 'Restless as weather. Hair lifts near their temper; so does everything else.' },
    { key: 'wis', label: 'The Oracle', weight: 16, priorities: ['wis', 'cha', 'con', 'dex', 'int', 'str'], skills: ['Insight', 'Religion'], guidance: 'The power whispers and they repeat it, sometimes mid-sentence. Uncertain which thoughts are theirs.' },
    { key: 'int', label: 'The Experiment', weight: 16, priorities: ['int', 'cha', 'con', 'dex', 'wis', 'str'], skills: ['Arcana', 'Investigation'], guidance: 'Studies their own gift like a naturalist with a dangerous specimen. Takes notes after every surge.' }
  ],
  barbarian: [
    { key: 'template', label: 'Template Barbarian', weight: 50, priorities: ['str', 'con', 'dex', 'wis', 'cha', 'int'], skills: ['Athletics', 'Perception'], guidance: 'Direct in all things. Civilization\'s rules are weather — noted, not obeyed.' },
    { key: 'con', label: 'The Wall', weight: 20, priorities: ['con', 'str', 'dex', 'wis', 'int', 'cha'], skills: ['Athletics', 'Survival'], guidance: 'Pain is information they mostly decline to read. Has been carried off two battlefields, walked off the third.' },
    { key: 'dex', label: 'The Feral', weight: 15, priorities: ['dex', 'str', 'con', 'wis', 'cha', 'int'], skills: ['Acrobatics', 'Perception'], guidance: 'Fights like an animal that chose to. Circles, feints, goes for the throat — conversation runs on similar lines.' },
    { key: 'wis', label: 'The Totem-Seer', weight: 15, priorities: ['wis', 'str', 'con', 'dex', 'cha', 'int'], skills: ['Nature', 'Perception'], guidance: 'The rage has a liturgy. Consults omens before battles and grandmothers during them.' }
  ],
  artificer: [
    { key: 'template', label: 'Template Artificer', weight: 50, priorities: ['int', 'con', 'dex', 'wis', 'cha', 'str'], skills: ['Arcana', 'Investigation'], guidance: 'Everything is a prototype, including this conversation. Hands are always mid-project.' },
    { key: 'dex', label: 'The Tinker', weight: 20, priorities: ['dex', 'int', 'con', 'wis', 'cha', 'str'], skills: ['Sleight of Hand', 'Investigation'], guidance: 'Fingers first, theory second. Your broken device is already open; they are sorry, it was instinct.' },
    { key: 'cha', label: 'The Showman', weight: 15, priorities: ['cha', 'int', 'con', 'dex', 'wis', 'str'], skills: ['Persuasion', 'Arcana'], guidance: 'Invention is theater. Every device has a reveal, a flourish, and ideally an investor.' },
    { key: 'wis', label: 'The Field Medic', weight: 15, priorities: ['wis', 'int', 'con', 'dex', 'str', 'cha'], skills: ['Medicine', 'Perception'], guidance: 'Builds for the worst day, not the best one. Calmest person in any emergency, by design and by practice.' }
  ]
};

function buildsFor(className) {
  return ARCHETYPES[(className || '').toLowerCase()] || null;
}

export function getArchetype(className, key) {
  const builds = buildsFor(className);
  if (!builds || !key) return null;
  return builds.find(b => b.key === key) || null;
}

export function templateArchetype(className) {
  return getArchetype(className, 'template');
}

/** Weighted archetype roll for a class. Template ~50%, off-builds split the rest. */
export function rollArchetypeKey(className) {
  const builds = buildsFor(className);
  if (!builds) return null;
  const totalWeight = builds.reduce((sum, b) => sum + b.weight, 0);
  let r = roll(totalWeight, 1, { reason: 'companion archetype' }).total;
  for (const b of builds) {
    r -= b.weight;
    if (r <= 0) return b.key;
  }
  return builds[builds.length - 1].key;
}

