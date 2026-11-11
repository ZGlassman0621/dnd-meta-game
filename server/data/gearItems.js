/**
 * gearItems.js — Tools and Gear (Wraith Wright, DM's Guild, v5.1 Feb 2022),
 * staged for the 2024 system. DATA ONLY. No wiring, no seeding, no shop,
 * no prompt, no session, no route, no migration.
 *
 * Source: extracted programmatically from the book's own price tables
 * (General Items Parts 1-2, Equipment Packs, Containers, Magical
 * Implements, Tools) in ~/workspace/dnd-app-review/gm-toolkits/gm2/tools-gear.txt,
 * then spot-checked against the tables (see gear-bank notes). Names,
 * costs and weights are the book's table values, in book order within
 * each category. No table entry was dropped.
 *
 * 2024 MAPPING RULE (Zach, 2026-10-28): map everything to 5e/2024, omit
 * nothing useful in the future. How that rule is implemented HERE:
 *   - Every priced table entry is retained, including items that also
 *     exist in the 2024 PHB. This module does NOT override the app's
 *     2024 PHB gear tables: at shop/use time, a 2024 PHB entry wins
 *     for a duplicate item, and this bank is the fallback for items
 *     with no 2024 PHB entry. That precedence is a wiring rule, not
 *     a field in this file.
 *   - costBasis is 'book' for every entry. That is an honest label:
 *     these are the book's 2022 prices, presented in 2024 format
 *     (cost in gp/sp/cp, weight in lb.), with NO 2014 mechanics
 *     attached — no DCs, no damage dice, no advantage rules, no
 *     effects, no spell text. A price-by-price check against the
 *     2024 PHB/DMG text is NOT claimed here (that text is not in
 *     this repo to check against); it is a future pass, and until
 *     then book prices for new items are provisional homebrew
 *     prices under Zach's homebrew policy (laid out here, approved
 *     by the test gate, then played as-is).
 *   - A '+' cost (e.g. '+5 gp', '+100 gp') is an ADD-ON to a base
 *     item's price, exactly as the book marks it (emblem, weapon
 *     etching, ordained weapon), not a standalone price.
 *   - A '+' weight (e.g. '41+ lb.') and a '—' weight are the book's
 *     own marks: '+' means at least that weight, '—' means negligible.
 *     One book weight was bracketed ([1 lb.] for rations); it is
 *     shown here plain as '1 lb.'.
 *   - '*' in a name is the book's own mark for an optional
 *     system-change focus (weapon etching/embellishment/circuitry,
 *     ordained weapon). It is kept in the name so the mark is not
 *     silently lost; whether those focuses are allowed is a DM
 *     ruling at use time, not a field here.
 *
 * What is NOT in this module, on purpose, and where it goes:
 *   - Pack CONTENTS (the prose lists under Equipment Packs) — not
 *     in v1; packs are price/weight entries only. Contents are a
 *     separate pass, not silently guessed from prose.
 *   - Container CAPACITIES (the separate Container Capacities
 *     table) — not in v1; a future field, not guessed here.
 *   - Trinkets (three flavour lists, no prices) — a separate
 *     flavour bank, not gear, not in v1.
 *   - Crafted compounds (quasi-magical/alchemical/herbal brews and
 *     poisons, Ch. 4) — a SEPARATE gated module per Zach's
 *     2026-10-28 ruling, mapped to 2024, not left out, but not
 *     mixed into a gear price list. Poisons in particular stay
 *     gated: they are not shop stock by default.
 *   - Ammunition has no separate price table in the extracted text;
 *     ammunition that is priced (ball bearings, caltrops, etc.)
 *     already appears under General Items.
 *
 * Seeding rule (Zach, 2026-10-27, still in force): this is a shelf,
 * not shop stock. Items are dealt/used sparsely, never front-loaded.
 */

export const GEAR_ITEMS = [
  {"id": "abacus", "name": "Abacus", "category": "general-item", "cost": "2 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "grappling-hook", "name": "Grappling hook", "category": "general-item", "cost": "2 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ascender", "name": "Ascender", "category": "general-item", "cost": "4 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "grooming-kit", "name": "Grooming kit", "category": "general-item", "cost": "5 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ashiaro", "name": "Ashiaro", "category": "general-item", "cost": "3 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hacksaw", "name": "Hacksaw", "category": "general-item", "cost": "10 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ball-bearings-bag-of-1-000", "name": "Ball bearings (bag of 1,000)", "category": "general-item", "cost": "1 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hammer", "name": "Hammer", "category": "general-item", "cost": "1 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ball-bearings-box-of-10-000", "name": "Ball bearings (box of 10,000)", "category": "general-item", "cost": "11 gp", "weight": "21 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hammer-muffled", "name": "Hammer, muffled", "category": "general-item", "cost": "4 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "banner-flag-or-pennant", "name": "Banner, flag, or pennant", "category": "general-item", "cost": "1 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hammer-sledge", "name": "Hammer, sledge", "category": "general-item", "cost": "2 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bedroll", "name": "Bedroll", "category": "general-item", "cost": "1 gp", "weight": "7 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "harness", "name": "Harness", "category": "general-item", "cost": "3 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bell", "name": "Bell", "category": "general-item", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hourglass", "name": "Hourglass", "category": "general-item", "cost": "25 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bell-kit", "name": "Bell kit", "category": "general-item", "cost": "12 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hunting-trap", "name": "Hunting trap", "category": "general-item", "cost": "5 gp", "weight": "25 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "blanket", "name": "Blanket", "category": "general-item", "cost": "5 sp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ink-1-ounce-bottle", "name": "Ink (1-ounce bottle)", "category": "general-item", "cost": "10 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "block-and-tackle", "name": "Block and tackle", "category": "general-item", "cost": "1 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ink-invisible-1-ounce-bottle", "name": "Ink, invisible (1-ounce bottle)", "category": "general-item", "cost": "15 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "book", "name": "Book", "category": "general-item", "cost": "25 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ink-pen", "name": "Ink pen", "category": "general-item", "cost": "2 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "book-code", "name": "Book, code", "category": "general-item", "cost": "35 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ladder-10-foot", "name": "Ladder (10-foot)", "category": "general-item", "cost": "1 sp", "weight": "25 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "book-lore", "name": "Book, lore", "category": "general-item", "cost": "30 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lamp", "name": "Lamp", "category": "general-item", "cost": "5 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "caltrops-bag-of-20", "name": "Caltrops (bag of 20)", "category": "general-item", "cost": "1 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lantern-bullseye", "name": "Lantern, bullseye", "category": "general-item", "cost": "10 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "caltrops-box-of-200", "name": "Caltrops (box of 200)", "category": "general-item", "cost": "11 gp", "weight": "21 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lantern-candle", "name": "Lantern, candle", "category": "general-item", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "candle", "name": "Candle", "category": "general-item", "cost": "1 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lantern-hooded", "name": "Lantern, hooded", "category": "general-item", "cost": "5 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "chain-10-feet", "name": "Chain (10 feet)", "category": "general-item", "cost": "5 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lantern-lighting-rig", "name": "Lantern, lighting rig", "category": "general-item", "cost": "45 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "chalk-1-piece", "name": "Chalk (1 piece)", "category": "general-item", "cost": "1 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lodestone", "name": "Lodestone", "category": "general-item", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "climbers-kit", "name": "Climber’s kit", "category": "general-item", "cost": "25 gp", "weight": "12 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lock", "name": "Lock", "category": "general-item", "cost": "10 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lock-fine", "name": "Lock, fine", "category": "general-item", "cost": "50 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-camouflage", "name": "Clothes, Camouflage", "category": "general-item", "cost": "10 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "magnifying-glass", "name": "Magnifying glass", "category": "general-item", "cost": "100 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-cold-weather", "name": "Clothes, Cold weather", "category": "general-item", "cost": "10 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "manacles", "name": "Manacles", "category": "general-item", "cost": "2 gp", "weight": "6 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-common", "name": "Clothes, Common", "category": "general-item", "cost": "5 sp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "manacles-fine", "name": "Manacles, fine", "category": "general-item", "cost": "50 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-costume", "name": "Clothes, Costume", "category": "general-item", "cost": "5 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "mantlet", "name": "Mantlet", "category": "general-item", "cost": "80 gp", "weight": "70 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-disguise", "name": "Clothes, Disguise", "category": "general-item", "cost": "10 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "map-area", "name": "Map, area", "category": "general-item", "cost": "5 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-fine", "name": "Clothes, Fine", "category": "general-item", "cost": "15 gp", "weight": "6 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "mess-kit", "name": "Mess kit", "category": "general-item", "cost": "2 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-peasant", "name": "Clothes, Peasant", "category": "general-item", "cost": "5 cp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "mirror-steel", "name": "Mirror, steel", "category": "general-item", "cost": "5 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "clothes-travelers", "name": "Clothes, Traveler’s", "category": "general-item", "cost": "2 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "nekode", "name": "Nekode", "category": "general-item", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "coin-grinder", "name": "Coin grinder", "category": "general-item", "cost": "4 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "oil-1-pint-flask", "name": "Oil (1-pint flask)", "category": "general-item", "cost": "1 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "cord-weapon", "name": "Cord, weapon", "category": "general-item", "cost": "2 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "oil-80-pint-cask", "name": "Oil (80-pint cask)", "category": "general-item", "cost": "8 gp", "weight": "100 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "crampons", "name": "Crampons", "category": "general-item", "cost": "2 gp", "weight": "1/4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "oil-can-pump", "name": "Oil can (pump)", "category": "general-item", "cost": "6 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "crowbar", "name": "Crowbar", "category": "general-item", "cost": "2 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "paper-one-sheet", "name": "Paper (one sheet)", "category": "general-item", "cost": "2 sp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "divers-kit", "name": "Diver’s kit", "category": "general-item", "cost": "5 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "parchment-one-sheet", "name": "Parchment (one sheet)", "category": "general-item", "cost": "1 sp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "doka", "name": "Doka", "category": "general-item", "cost": "1 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "perfume-vial", "name": "Perfume (vial)", "category": "general-item", "cost": "5 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ear-trumpet", "name": "Ear trumpet", "category": "general-item", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "periscope", "name": "Periscope", "category": "general-item", "cost": "8 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "earplugs", "name": "Earplugs", "category": "general-item", "cost": "1 sp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "pick-miners", "name": "Pick, miner’s", "category": "general-item", "cost": "2 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "falling-sail", "name": "Falling sail", "category": "general-item", "cost": "85 gp", "weight": "15 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "piton", "name": "Piton", "category": "general-item", "cost": "5 cp", "weight": "1/4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "filtered-mask", "name": "Filtered mask", "category": "general-item", "cost": "8 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "pole-10-foot", "name": "Pole (10-foot)", "category": "general-item", "cost": "5 cp", "weight": "7 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "fire-kit", "name": "Fire kit", "category": "general-item", "cost": "4 cp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "pole-collapsible-10-foot", "name": "Pole, collapsible (10-foot)", "category": "general-item", "cost": "5 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "fishing-tackle", "name": "Fishing Tackle", "category": "general-item", "cost": "1 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "raiment-repair-kit", "name": "Raiment repair kit", "category": "general-item", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "glass-breakers-kit", "name": "Glass breaker’s kit", "category": "general-item", "cost": "15 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rain-catcher", "name": "Rain catcher", "category": "general-item", "cost": "1 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "goggles", "name": "Goggles", "category": "general-item", "cost": "2 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ram-portable", "name": "Ram, portable", "category": "general-item", "cost": "4 gp", "weight": "35 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rations-1-day", "name": "Rations (1 day)", "category": "general-item", "cost": "5 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sprayer", "name": "Sprayer", "category": "general-item", "cost": "6 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rations-compact-1-day", "name": "Rations, compact (1 day)", "category": "general-item", "cost": "2 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "spyglass", "name": "Spyglass", "category": "general-item", "cost": "1,000 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "robes", "name": "Robes", "category": "general-item", "cost": "1 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "spyglass-compact", "name": "Spyglass, compact", "category": "general-item", "cost": "600 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "robes-fine-or-silk", "name": "Robes, fine or silk", "category": "general-item", "cost": "50 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "stretcher-folding", "name": "Stretcher, folding", "category": "general-item", "cost": "6 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rope-hempen-50-feet", "name": "Rope, hempen (50 feet)", "category": "general-item", "cost": "1 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "string-or-twine-50-feet", "name": "String or twine (50 feet)", "category": "general-item", "cost": "1 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rope-ladder-hempen-50-feet", "name": "Rope ladder, hempen (50 feet)", "category": "general-item", "cost": "3 gp", "weight": "24 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "swim-bladders", "name": "Swim bladders", "category": "general-item", "cost": "3 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rope-ladder-silk-50-feet", "name": "Rope ladder, silk (50 feet)", "category": "general-item", "cost": "26 gp", "weight": "12 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tate", "name": "Tate", "category": "general-item", "cost": "35 gp", "weight": "35 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rope-silk-50-feet", "name": "Rope, silk (50 feet)", "category": "general-item", "cost": "10 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "saw", "name": "Saw", "category": "general-item", "cost": "3 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tent-pavilion", "name": "Tent, Pavilion", "category": "general-item", "cost": "30 gp", "weight": "350 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sheath-concealed", "name": "Sheath, concealed", "category": "general-item", "cost": "4 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tent-six-person", "name": "Tent, Six-person", "category": "general-item", "cost": "5 gp", "weight": "100 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sheath-false-bottom", "name": "Sheath, false bottom", "category": "general-item", "cost": "12 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tent-two-person", "name": "Tent, Two-person", "category": "general-item", "cost": "2 gp", "weight": "20 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sheath-poison", "name": "Sheath, poison", "category": "general-item", "cost": "10 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tinderbox", "name": "Tinderbox", "category": "general-item", "cost": "5 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "shikaro", "name": "Shikaro", "category": "general-item", "cost": "6 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "torch", "name": "Torch", "category": "general-item", "cost": "1 cp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "shovel", "name": "Shovel", "category": "general-item", "cost": "2 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "torch-signal", "name": "Torch, signal", "category": "general-item", "cost": "1 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "signet-ring", "name": "Signet ring", "category": "general-item", "cost": "5 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "water-clock", "name": "Water clock", "category": "general-item", "cost": "1,000 gp", "weight": "100 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "slate-board", "name": "Slate board", "category": "general-item", "cost": "5 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "water-shoes", "name": "Water shoes", "category": "general-item", "cost": "4 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "snorkel", "name": "Snorkel", "category": "general-item", "cost": "5 cp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "weaponblack", "name": "Weaponblack", "category": "general-item", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "snow-shoes-or-skis", "name": "Snow shoes or skis", "category": "general-item", "cost": "2 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "whetstone", "name": "Whetstone", "category": "general-item", "cost": "1 cp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "soap", "name": "Soap", "category": "general-item", "cost": "2 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "whistle-animal", "name": "Whistle, animal", "category": "general-item", "cost": "2 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "scale-merchants", "name": "Scale, merchant’s", "category": "general-item", "cost": "5 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "whistle-signal", "name": "Whistle, signal", "category": "general-item", "cost": "5 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sealing-wax", "name": "Sealing wax", "category": "general-item", "cost": "5 cp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "winch", "name": "Winch", "category": "general-item", "cost": "7 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "spikes-iron-10", "name": "Spikes, iron (10)", "category": "general-item", "cost": "1 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcanists-pack", "name": "Arcanist’s pack", "category": "equipment-pack", "cost": "35 gp", "weight": "8 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lockbreakers-pack", "name": "Lockbreaker’s pack", "category": "equipment-pack", "cost": "40 gp", "weight": "33 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "artisans-pack", "name": "Artisan’s pack", "category": "equipment-pack", "cost": "38 gp", "weight": "41+ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lb-merchants-pack", "name": "lb.      Merchant’s pack", "category": "equipment-pack", "cost": "19 gp", "weight": "44 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "builders-pack", "name": "Builder’s pack", "category": "equipment-pack", "cost": "25 gp", "weight": "50+ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lb-messengers-pack", "name": "lb.      Messenger’s pack", "category": "equipment-pack", "cost": "10 gp", "weight": "52 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "burglars-pack", "name": "Burglar’s pack", "category": "equipment-pack", "cost": "12 gp", "weight": "42½ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "minstrels-pack", "name": "Minstrel’s pack", "category": "equipment-pack", "cost": "36 gp", "weight": "29 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "chefs-pack", "name": "Chef’s pack", "category": "equipment-pack", "cost": "30 gp", "weight": "49 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "monster-hunters-pack", "name": "Monster hunter’s pack", "category": "equipment-pack", "cost": "33 gp", "weight": "49½ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "courtiers-pack", "name": "Courtier’s pack", "category": "equipment-pack", "cost": "30 gp", "weight": "32½ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "naturalists-pack", "name": "Naturalist’s pack", "category": "equipment-pack", "cost": "55 gp", "weight": "48 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "crafters-pack", "name": "Crafter’s pack", "category": "equipment-pack", "cost": "12 gp", "weight": "47+ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lb-nobles-pack", "name": "lb.      Noble’s pack", "category": "equipment-pack", "cost": "40 gp", "weight": "51 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "diplomats-pack", "name": "Diplomat’s pack", "category": "equipment-pack", "cost": "39 gp", "weight": "36 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "priests-pack", "name": "Priest’s pack", "category": "equipment-pack", "cost": "19 gp", "weight": "21 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "dungeoneers-pack", "name": "Dungeoneer’s pack", "category": "equipment-pack", "cost": "12 gp", "weight": "51½ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "riders-pack", "name": "Rider’s pack", "category": "equipment-pack", "cost": "12 gp", "weight": "72 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "entertainers-pack", "name": "Entertainer’s pack", "category": "equipment-pack", "cost": "40 gp", "weight": "33 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sailors-pack", "name": "Sailor’s pack", "category": "equipment-pack", "cost": "32 gp", "weight": "50 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "explorers-pack", "name": "Explorer’s pack", "category": "equipment-pack", "cost": "10 gp", "weight": "68 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "savages-pack", "name": "Savage’s pack", "category": "equipment-pack", "cost": "5 gp", "weight": "22 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "fabricators-pack", "name": "Fabricator’s pack", "category": "equipment-pack", "cost": "65 gp", "weight": "52+ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lb-scholars-pack", "name": "lb.      Scholar’s pack", "category": "equipment-pack", "cost": "40 gp", "weight": "11 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "healers-pack", "name": "Healer’s pack", "category": "equipment-pack", "cost": "16 gp", "weight": "29 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "soldiers-pack", "name": "Soldier’s pack", "category": "equipment-pack", "cost": "10 gp", "weight": "51 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "illustrators-pack", "name": "Illustrator’s pack", "category": "equipment-pack", "cost": "25 gp", "weight": "29+ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lb-spys-pack", "name": "lb.      Spy’s pack", "category": "equipment-pack", "cost": "40 gp", "weight": "30 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "infiltrators-pack", "name": "Infiltrator’s pack", "category": "equipment-pack", "cost": "39 gp", "weight": "40½ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "supplicants-pack", "name": "Supplicant’s pack", "category": "equipment-pack", "cost": "40 gp", "weight": "42 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "knights-pack", "name": "Knight’s pack", "category": "equipment-pack", "cost": "39 gp", "weight": "85 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "trackers-pack", "name": "Tracker’s pack", "category": "equipment-pack", "cost": "10 gp", "weight": "36 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "laborers-pack", "name": "Laborer’s pack", "category": "equipment-pack", "cost": "10 gp", "weight": "51 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "travelers-pack", "name": "Traveler’s pack", "category": "equipment-pack", "cost": "10 gp", "weight": "44 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "backpack", "name": "Backpack", "category": "container", "cost": "2 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "haversack", "name": "Haversack", "category": "container", "cost": "5 gp", "weight": "7 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bandoleer", "name": "Bandoleer", "category": "container", "cost": "2 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "jug-or-pitcher", "name": "Jug or pitcher", "category": "container", "cost": "2 cp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "barrel", "name": "Barrel", "category": "container", "cost": "3 gp", "weight": "70 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ketch", "name": "Ketch", "category": "container", "cost": "2 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "basket", "name": "Basket", "category": "container", "cost": "4 sp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lockbox", "name": "Lockbox", "category": "container", "cost": "10 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bottle-glass", "name": "Bottle, glass", "category": "container", "cost": "2 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "pot-iron", "name": "Pot, iron", "category": "container", "cost": "2 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "box", "name": "Box", "category": "container", "cost": "1 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "pouch", "name": "Pouch", "category": "container", "cost": "5 sp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "box-map-or-scroll", "name": "Box, map or scroll", "category": "container", "cost": "5 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "quiver", "name": "Quiver", "category": "container", "cost": "1 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bucket", "name": "Bucket", "category": "container", "cost": "5 cp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "rucksack", "name": "Rucksack", "category": "container", "cost": "9 gp", "weight": "9 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "case-crossbow-bolt", "name": "Case, crossbow bolt", "category": "container", "cost": "1 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sack", "name": "Sack", "category": "container", "cost": "1 cp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "case-map-or-scroll", "name": "Case, map or scroll", "category": "container", "cost": "1 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sack-large", "name": "Sack, large", "category": "container", "cost": "5 cp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "cask-or-keg", "name": "Cask or keg", "category": "container", "cost": "2 gp", "weight": "12 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "satchel", "name": "Satchel", "category": "container", "cost": "1 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "chest", "name": "Chest", "category": "container", "cost": "5 gp", "weight": "25 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "satchel-water-resistant", "name": "Satchel, water resistant", "category": "container", "cost": "5 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "compartment-hidden", "name": "Compartment, hidden", "category": "container", "cost": "5 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "vial", "name": "Vial", "category": "container", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "crate", "name": "Crate", "category": "container", "cost": "2 gp", "weight": "40 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "waterskin-full", "name": "Waterskin (full)", "category": "container", "cost": "2 sp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "flask-or-tankard", "name": "Flask or tankard", "category": "container", "cost": "2 cp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcane-focus-crystal", "name": "Arcane focus, Crystal", "category": "magical-implement", "cost": "10 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-symbol-amulet", "name": "Holy symbol, Amulet", "category": "magical-implement", "cost": "5 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcane-focus-orb", "name": "Arcane focus, Orb", "category": "magical-implement", "cost": "20 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-symbol-amulet-ornamental", "name": "Holy symbol, Amulet, ornamental", "category": "magical-implement", "cost": "10 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcane-focus-rod", "name": "Arcane focus, Rod", "category": "magical-implement", "cost": "10 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-symbol-emblem", "name": "Holy symbol, Emblem", "category": "magical-implement", "cost": "+5 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcane-focus-staff", "name": "Arcane focus, Staff", "category": "magical-implement", "cost": "5 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-symbol-flask-empty-1-pint", "name": "Holy symbol, Flask (empty, 1 pint)", "category": "magical-implement", "cost": "6 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcane-focus-wand", "name": "Arcane focus, Wand", "category": "magical-implement", "cost": "10 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-symbol-ordained-weapon", "name": "Holy symbol, Ordained weapon *", "category": "magical-implement", "cost": "+100 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "arcane-focus-weapon-etching", "name": "Arcane focus, Weapon etching *", "category": "magical-implement", "cost": "+50 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-symbol-reliquary", "name": "Holy symbol, Reliquary", "category": "magical-implement", "cost": "5 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "component-pouch", "name": "Component pouch", "category": "magical-implement", "cost": "25 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "holy-water-flask", "name": "Holy water (flask)", "category": "magical-implement", "cost": "25 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ink-rare-1-ounce-bottle", "name": "Ink, rare (1-ounce bottle)", "category": "magical-implement", "cost": "100 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-ritual-sickle", "name": "Druidic focus, Ritual sickle", "category": "magical-implement", "cost": "2 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-sacrifice", "name": "Druidic focus, Sacrifice", "category": "magical-implement", "cost": "—", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "psionic-focus-circlet", "name": "Psionic Focus, Circlet", "category": "magical-implement", "cost": "25 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-sprig-of-mistletoe", "name": "Druidic focus, Sprig of mistletoe", "category": "magical-implement", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "psionic-focus-dorje", "name": "Psionic Focus, Dorje", "category": "magical-implement", "cost": "15 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-totem", "name": "Druidic focus, Totem", "category": "magical-implement", "cost": "1 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "psionic-focus-pendant", "name": "Psionic Focus, Pendant", "category": "magical-implement", "cost": "10 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-totem-greater", "name": "Druidic focus, Totem, greater", "category": "magical-implement", "cost": "35 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "psionic-focus-staff", "name": "Psionic Focus, Staff", "category": "magical-implement", "cost": "5 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-weapon-embellishment", "name": "Druidic focus, Weapon embellishment *", "category": "magical-implement", "cost": "+25 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "psionic-focus-weapon-circuitry", "name": "Psionic Focus, Weapon Circuitry *", "category": "magical-implement", "cost": "+75 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-wooden-staff", "name": "Druidic focus, Wooden staff", "category": "magical-implement", "cost": "5 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "spellbook", "name": "Spellbook", "category": "magical-implement", "cost": "50 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "druidic-focus-yew-wand", "name": "Druidic focus, Yew wand", "category": "magical-implement", "cost": "10 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "spellbook-travelling", "name": "Spellbook, travelling", "category": "magical-implement", "cost": "30 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "torch-everburning", "name": "Torch, everburning", "category": "magical-implement", "cost": "50 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "unholy-water-flask", "name": "Unholy water (flask)", "category": "magical-implement", "cost": "25 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "alchemists-supplies", "name": "Alchemist’s supplies", "category": "artisan-tool", "cost": "50 gp", "weight": "8 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "bagpipes", "name": "Bagpipes", "category": "musical-instrument", "cost": "30 gp", "weight": "6 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "brewers-supplies", "name": "Brewer’s supplies", "category": "artisan-tool", "cost": "20 gp", "weight": "9 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "birdpipes", "name": "Birdpipes", "category": "musical-instrument", "cost": "10 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "calligraphers-supplies", "name": "Calligrapher’s supplies", "category": "artisan-tool", "cost": "10 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "drum", "name": "Drum", "category": "musical-instrument", "cost": "6 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "carpenters-tools", "name": "Carpenter’s tools", "category": "artisan-tool", "cost": "8 gp", "weight": "6 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "dulcimer", "name": "Dulcimer", "category": "musical-instrument", "cost": "25 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "cartographers-tools", "name": "Cartographer’s tools", "category": "artisan-tool", "cost": "15 gp", "weight": "6 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "flute", "name": "Flute", "category": "musical-instrument", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "cobblers-tools", "name": "Cobbler’s tools", "category": "artisan-tool", "cost": "5 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "glaur", "name": "Glaur", "category": "musical-instrument", "cost": "9 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "cooks-utensils", "name": "Cook’s utensils", "category": "artisan-tool", "cost": "1 gp", "weight": "8 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hand-drum", "name": "Hand drum", "category": "musical-instrument", "cost": "3 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "glassblowers-tools", "name": "Glassblower’s tools", "category": "artisan-tool", "cost": "30 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "harp", "name": "Harp", "category": "musical-instrument", "cost": "20 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "jewelers-tools", "name": "Jeweler’s tools", "category": "artisan-tool", "cost": "25 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "horn", "name": "Horn", "category": "musical-instrument", "cost": "3 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "leatherworkers-tools", "name": "Leatherworker’s tools", "category": "artisan-tool", "cost": "5 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lute", "name": "Lute", "category": "musical-instrument", "cost": "35 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "masons-tools", "name": "Mason’s tools", "category": "artisan-tool", "cost": "10 gp", "weight": "8 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "lyre", "name": "Lyre", "category": "musical-instrument", "cost": "30 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "painters-supplies", "name": "Painter’s supplies", "category": "artisan-tool", "cost": "10 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "longhorn", "name": "Longhorn", "category": "musical-instrument", "cost": "20 gp", "weight": "15 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "potters-tools", "name": "Potter’s tools", "category": "artisan-tool", "cost": "10 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "pan-flute", "name": "Pan flute", "category": "musical-instrument", "cost": "12 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "sculptors-tools", "name": "Sculptor’s tools", "category": "artisan-tool", "cost": "15 gp", "weight": "7 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "shawm", "name": "Shawm", "category": "musical-instrument", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "smiths-tools", "name": "Smith’s tools", "category": "artisan-tool", "cost": "20 gp", "weight": "8 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "songhorn", "name": "Songhorn", "category": "musical-instrument", "cost": "2 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tattoo-artists-tools", "name": "Tattoo artist’s tools", "category": "artisan-tool", "cost": "15 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tantan", "name": "Tantan", "category": "musical-instrument", "cost": "5 sp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tinkers-tools", "name": "Tinker’s tools", "category": "artisan-tool", "cost": "50 gp", "weight": "10 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "thelarr", "name": "Thelarr", "category": "musical-instrument", "cost": "35 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "weavers-tools", "name": "Weaver’s tools", "category": "artisan-tool", "cost": "1 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "tocken", "name": "Tocken", "category": "musical-instrument", "cost": "10 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "woodcarvers-tools", "name": "Woodcarver’s tools", "category": "artisan-tool", "cost": "1 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "viol", "name": "Viol", "category": "musical-instrument", "cost": "30 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "wargong", "name": "Wargong", "category": "musical-instrument", "cost": "12 gp", "weight": "7 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "dart-and-board-set", "name": "Dart-and-board set", "category": "gaming-set", "cost": "3 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "yarting", "name": "Yarting", "category": "musical-instrument", "cost": "30 gp", "weight": "1½ lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "dice-set", "name": "Dice set", "category": "gaming-set", "cost": "1 sp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "zulkoon", "name": "Zulkoon", "category": "musical-instrument", "cost": "50 gp", "weight": "25 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "dragonchess-set", "name": "Dragonchess set", "category": "gaming-set", "cost": "1 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "hnefatafl-set", "name": "Hnefatafl set", "category": "gaming-set", "cost": "2 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "appraisers-tools", "name": "Appraiser’s tools", "category": "misc-tool", "cost": "8 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "kubb-set", "name": "Kubb set", "category": "gaming-set", "cost": "5 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "disguise-kit", "name": "Disguise kit", "category": "misc-tool", "cost": "25 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "nine-mens-morris-set", "name": "Nine men’s morris set", "category": "gaming-set", "cost": "1 sp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "forgery-kit", "name": "Forgery kit", "category": "misc-tool", "cost": "15 gp", "weight": "5 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "playing-card-set", "name": "Playing card set", "category": "gaming-set", "cost": "5 sp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "fortune-tellers-kit", "name": "Fortune teller’s kit", "category": "misc-tool", "cost": "6 gp", "weight": "4 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "prophets-gambit-tarokka-set", "name": "Prophet’s gambit (Tarokka) set", "category": "gaming-set", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "herbalism-kit", "name": "Herbalism kit", "category": "misc-tool", "cost": "5 gp", "weight": "3 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "ring-toss-set", "name": "Ring-toss set", "category": "gaming-set", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "navigators-tools", "name": "Navigator’s tools", "category": "misc-tool", "cost": "25 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "three-dragon-ante-set", "name": "Three-dragon ante set", "category": "gaming-set", "cost": "1 gp", "weight": "—", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "poisoners-kit", "name": "Poisoner’s kit", "category": "misc-tool", "cost": "50 gp", "weight": "2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "trictrac-set", "name": "Trictrac set", "category": "gaming-set", "cost": "2 gp", "weight": "1/2 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
  {"id": "thieves-tools", "name": "Thieves’ tools", "category": "misc-tool", "cost": "25 gp", "weight": "1 lb.", "costBasis": "book", "sourceBook": "Tools and Gear (Wraith Wright, v5.1, 2022)"},
];

export function gearItems() {
  return GEAR_ITEMS.map((g) => ({ ...g }));
}
export function gearById(id) {
  const found = GEAR_ITEMS.find((g) => g.id === id);
  return found ? { ...found } : null;
}
export function gearIds() {
  return GEAR_ITEMS.map((g) => g.id);
}
export function gearByCategory(category) {
  return GEAR_ITEMS.filter((g) => g.category === category).map((g) => ({ ...g }));
}
