/*
 * tests/npc-bank-wiring.test.js — NPC-bank "use + recall" step.
 *
 * Pins (all against the real service + real temp DB):
 *   - deal 'apothecary' -> Gwinear Pearce, exact bank fields, and the
 *     DB row read back by id matches those fields exactly
 *   - deal 'apothecary' again -> a DIFFERENT name (second entry)
 *   - recallBankNpc(id) -> same name/appearance/personality/hook
 *   - deal unknown profession -> null
 *   - dealt row contains every field formatCustomNpcs consumes, all
 *     non-null except location when not given; a deal WITH a location
 *     stores it
 *   - dealt fields are byte-identical to the bank entry
 *   - deal a profession 20 times -> 20 distinct bank names, 21st -> null
 *     (no repeat, no invention, in a throwaway temp DB only)
 *
 * Assumes the npcs table already has the columns saveExtractedNpcs
 * writes. No migration is made here; if the schema differs, this
 * gate surfaces it.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-npc-bank-wiring-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
await dbModule.initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const { dealBankNpc, recallBankNpc, bankMarker } = await import(
  svc('server/services/npcBankService.js')
);
const bank = await import(svc('server/data/npcBanks.js'));

const db = { dbGet: dbModule.dbGet, dbRun: dbModule.dbRun, dbAll: dbModule.dbAll };

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}
function group(name) {
  console.log(`\n== ${name}`);
}
const eq = (a, b) => a === b;

group('Deal first apothecary');
const first = await dealBankNpc({ profession: 'apothecary', db });
const bankApothecary = bank.npcsFor('apothecary');
assert(first !== null, 'deal apothecary returns an NPC');
assert(eq(first.name, 'Gwinear Pearce'), `first apothecary is Gwinear Pearce, got ${first && first.name}`);
assert(eq(first.profession, 'Apothecary'), `profession is stored key 'Apothecary', got ${first && first.profession}`);
assert(eq(first.bankIndex, 0), `bankIndex is 0, got ${first && first.bankIndex}`);
assert(eq(first.appearance, 'Small, beady eyed, hairy'), 'appearance matches bank');
assert(eq(first.personality, 'Friendly, hesitant, artificial'), 'personality matches bank');
assert(eq(first.hook, 'Friend with fey'), 'hook matches bank');
assert(first.location === null, 'location is null when not given');

const row = await db.dbGet('SELECT * FROM npcs WHERE id = ?', [first.id]);
assert(row != null, 'dealt NPC row exists in DB by id');
assert(eq(row.name, 'Gwinear Pearce'), 'DB row name matches');
assert(eq(row.race, 'Human'), 'DB row race is Human (Register entries are human in source)');
assert(eq(row.gender, 'Male'), `DB row gender maps M -> Male, got ${row && row.gender}`);
assert(eq(row.occupation, 'Apothecary'), 'DB row occupation is stored profession key');
assert(eq(row.distinguishing_marks, 'Small, beady eyed, hairy'), 'DB distinguishing_marks = appearance');
assert(eq(row.distinguishing_features, 'Small, beady eyed, hairy'), 'DB distinguishing_features = appearance');
assert(eq(row.personality_trait_1, 'Friendly, hesitant, artificial'), 'DB personality_trait_1 = personality');
assert(eq(row.motivation, 'Friend with fey'), 'DB motivation = hook');
assert(
  eq(row.background_notes, 'Bank source: Apothecary #1 of 20. Hook: Friend with fey'),
  `DB background_notes marker format, got ${row && row.background_notes}`
);
assert(eq(row.relationship_to_party, 'neutral'), 'DB relationship_to_party is neutral');
assert(eq(row.campaign_availability, 'available'), 'DB campaign_availability is available');
assert(eq(row.enrichment_level, 0), 'DB enrichment_level is 0');

group('Deal second apothecary is different, not a repeat');
const second = await dealBankNpc({ profession: 'apothecary', db });
assert(second !== null, 'second deal returns an NPC');
assert(second.name !== first.name, `second deal is a different name, got ${second && second.name}`);
assert(eq(second.name, bankApothecary[1].name), 'second deal is the bank second entry');
assert(eq(second.bankIndex, 1), `second deal bankIndex is 1, got ${second && second.bankIndex}`);

group('Recall returns the same NPC');
const recalled = await recallBankNpc(first.id, db);
assert(recalled !== null, 'recall returns a row');
assert(eq(recalled.name, first.name), 'recall name matches dealt');
assert(eq(recalled.profession, 'Apothecary'), 'recall profession is occupation');
assert(eq(recalled.appearance, first.appearance), 'recall appearance matches dealt');
assert(eq(recalled.personality, first.personality), 'recall personality matches dealt');
assert(eq(recalled.hook, first.hook), 'recall hook matches dealt');
assert(eq(recalled.bankSource, 'Bank source: Apothecary #1 of 20. Hook: Friend with fey'), 'recall bankSource is background_notes');
assert((await recallBankNpc(999999, db)) === null, 'recall unknown id returns null');

group('Unknown profession and byte-identical bank fields');
assert((await dealBankNpc({ profession: 'not-a-profession', db })) === null, 'unknown profession returns null');
assert((await dealBankNpc({ profession: '', db })) === null, 'empty profession returns null');
const entry0 = bankApothecary[0];
assert(
  eq(first.name, entry0.name) &&
    eq(first.appearance, entry0.appearance) &&
    eq(first.personality, entry0.personality) &&
    eq(first.hook, entry0.hook),
  'dealt fields are byte-identical to the bank entry (no invention, no rewording)'
);

group('formatCustomNpcs fields present; location stored when given');
const promptFields = [
  'name',
  'race',
  'gender',
  'occupation',
  'current_location',
  'relationship_to_party',
  'motivation',
  'personality_trait_1',
  'distinguishing_features',
  'campaign_availability',
];
for (const f of promptFields) {
  if (f === 'current_location') {
    assert(row[f] === null, 'current_location is the only nullable prompt field when no location given');
  } else {
    assert(row[f] !== null && row[f] !== undefined && row[f] !== '', `prompt field ${f} is non-null`);
  }
}
const withLocation = await dealBankNpc({ profession: 'blacksmith', location: 'Mill Road', db });
assert(withLocation !== null, 'deal with location returns an NPC');
assert(eq(withLocation.location, 'Mill Road'), 'deal return carries the location');
const withLocationRow = await db.dbGet('SELECT * FROM npcs WHERE id = ?', [withLocation.id]);
assert(eq(withLocationRow.current_location, 'Mill Road'), 'DB current_location stores the given location');
assert(
  eq(bankMarker('Blacksmith', withLocation.bankIndex), `Bank source: Blacksmith #${withLocation.bankIndex + 1} of 20`),
  'bankMarker helper matches the stored marker format'
);

group('Exhaustion: 20 deals, then null (temp DB only)');
const barberBank = bank.npcsFor('barber');
assert(barberBank && barberBank.length === 20, 'barber bank has 20 entries');
const dealtNames = [];
for (let i = 0; i < 20; i++) {
  const d = await dealBankNpc({ profession: 'barber', db });
  assert(d !== null, `barber deal ${i + 1} returns an NPC`);
  if (d) dealtNames.push(d.name);
}
assert(new Set(dealtNames).size === 20, '20 barber deals are 20 distinct names (no repeat)');
assert(
  dealtNames.every((n) => barberBank.some((e) => e.name === n)),
  'every dealt barber name is in the bank (no invention)'
);
assert((await dealBankNpc({ profession: 'barber', db })) === null, '21st barber deal returns null (exhausted, not invented)');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
