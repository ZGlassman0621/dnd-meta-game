/**
 * Marker schemas — single source of truth for every marker the DM AI emits.
 *
 * **Canonical role (post-Phase-3.2 SC-6.5):** this module + `markerPipeline.js`
 * are the canonical path for marker validation + dispatch. Every marker
 * in `MARKER_SCHEMAS` flows through `validateDmMarkers` (validation +
 * correction-loop feedback) and `processResponseMarkers` (handler
 * dispatch). The legacy `detectXxx()` functions in `dmSessionService.js`
 * remain exported for back-compat but are no longer invoked from the
 * production route path.
 *
 * Problem the migration solved: markers used to be documented in prose
 * inside the DM system prompt, parsed ad-hoc by regex at each call site,
 * and silently dropped on malformed emission. When the model typo'd a field
 * or omitted a required key, the side effect never fired. Over long
 * campaigns these silent drops accumulated: promises untracked, notoriety
 * lost, canon facts missing. The player never knew; the AI never knew either.
 *
 * Architecture:
 *   1. **Schemas**: every marker has a schema here — required/optional
 *      fields, types, enums. One source of truth.
 *   2. **Parsing**: `parseMarkerBody(body, schemaKey)` returns either
 *      `{ ok: true, data }` or `{ ok: false, errors }`. Field extraction
 *      via `extractField` handles both quoted and bareword formats.
 *   3. **Dispatch**: registered handlers in `markerPipeline.js` fire on
 *      successful parses. Handlers live in consumer services
 *      (pietyService, survivalService, merchantService, etc.) and call
 *      registerHandler() at module load.
 *   4. **Correction loop**: validation failures are RECORDED, not
 *      swallowed — stored on session_config.pendingMarkerCorrections so
 *      the next turn's prompt injects a [SYSTEM NOTE] asking the model to
 *      re-emit correctly. That note is INVISIBLE to the player but gives
 *      the AI a concrete correction target.
 *
 * **Schemas-without-handlers** is a first-class end-state for some
 * markers — schema validation buys correction-loop feedback even when
 * the marker doesn't dispatch independently. Four legitimate rationales
 * (DECISION_LOG entry 2026-05-05 "Phase 3 SC-6.4 close-out"):
 *   1. **Ordering invariants** — sibling markers must run in a specific
 *      order that per-handler dispatch can't guarantee (e.g., 19 prelude
 *      markers — AGE_ADVANCE → HP_CHANGE, CANON_FACT_RETIRE → CANON_FACT)
 *   2. **Aggregated returns** — route handler combines per-marker results
 *      into one structured response payload (the prelude markers also)
 *   3. **No side-effect target** — schema buys correction-loop feedback;
 *      no consumer service to handle (e.g., SWIM)
 *   4. **Orchestrated-with-sibling-marker** — coupled markers fold into
 *      one handler internally rather than dispatching independently
 *      (e.g., ADD_ITEM consumed by MERCHANT_SHOP handler)
 *
 * This shape will become tool-use definitions directly when the
 * migration to native tool-use lands — no rewrite required.
 */

/**
 * Marker field type definitions.
 *
 * Each field spec has:
 *   - `type`: 'string' | 'int' | 'enum' | 'bool'
 *   - `required`: boolean (default true)
 *   - `enum`: array of allowed values (type=enum)
 *   - `min` / `max`: numeric bounds (type=int)
 */

export const MARKER_SCHEMAS = {
  MERCHANT_SHOP: {
    position: 'first',
    fields: {
      Merchant: { type: 'string', required: true },
      Type: { type: 'enum', enum: ['general', 'blacksmith', 'alchemist', 'magic', 'jeweler', 'tanner', 'tailor'], required: true },
      Location: { type: 'string', required: true }
    }
  },

  MERCHANT_REFER: {
    position: 'inline',
    fields: {
      From: { type: 'string', required: true },
      To: { type: 'string', required: true },
      Item: { type: 'string', required: true }
    }
  },

  ADD_ITEM: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Price_GP: { type: 'int', required: true, min: 0 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: true },
      Category: { type: 'string', required: true }
    }
  },

  // SC-6.4b extension: Price_GP min relaxed to 0 + Price_SP / Price_CP /
  // Deposit_SP / Deposit_CP / Description added as optional. The legacy
  // detect-function tolerated mixed-denomination prices and a free-text
  // description; preserving that tolerance avoids tightening the AI-facing
  // contract as a side effect of the marker-pipeline migration. Schema
  // still requires at least Merchant, Item, Deposit_GP, Lead_Time_Days.
  MERCHANT_COMMISSION: {
    position: 'inline',
    fields: {
      Merchant: { type: 'string', required: true },
      Item: { type: 'string', required: true },
      Price_GP: { type: 'int', required: true, min: 0 },
      Price_SP: { type: 'int', required: false, min: 0 },
      Price_CP: { type: 'int', required: false, min: 0 },
      Deposit_GP: { type: 'int', required: true, min: 0 },
      Deposit_SP: { type: 'int', required: false, min: 0 },
      Deposit_CP: { type: 'int', required: false, min: 0 },
      Lead_Time_Days: { type: 'int', required: true, min: 1 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: false },
      Hook: { type: 'string', required: false },
      Description: { type: 'string', required: false }
    }
  },

  COMBAT_START: {
    position: 'last',
    fields: {
      Enemies: { type: 'string', required: true },
      // Scene layer wiring: optional dungeon-room auto-link for the new
      // encounter. A failed link surfaces in roomLink and stores nothing;
      // combat still starts (legacy, not a wrong room).
      Scene: { type: 'number', required: false },
      Room: { type: 'string', required: false }
    }
  },

  COMBAT_END: {
    position: 'last',
    fields: {}
  },

  ENEMY_DAMAGE: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      // Combat item 7: Amount is required only for declared damage.
      // A table cause (Fall/Trap/Hazard) replaces it — the engine rolls.
      Amount: { type: 'number', required: false },
      Fall: { type: 'int', required: false, min: 0 },
      Trap: { type: 'string', required: false },
      Hazard: { type: 'string', required: false },
      Severity: { type: 'string', required: false },
      Type: { type: 'string', required: false },
      Save: { type: 'string', required: false }
    }
  },

  ENEMY_ATTACK: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      Target: { type: 'string', required: false },
      // Combat item 3, Tier 3: Ready="true" fires a stored enemy
      // READY (reaction spent, like the party ATTACK Ready flag).
      Ready: { type: 'bool', required: false },
      // Combat item 5: enemy action economy — Multiattack pattern
      // swings, legendary attacks (Cost, LegendaryTotal), and
      // bonus attacks (charged, like the party's Bonus flag).
      Multiattack: { type: 'bool', required: false },
      Legendary: { type: 'bool', required: false },
      Cost: { type: 'number', required: false },
      LegendaryTotal: { type: 'number', required: false },
      Bonus: { type: 'bool', required: false }
    }
  },

  ATTACK: {
    position: 'inline',
    fields: {
      Attacker: { type: 'string', required: true },
      Target: { type: 'string', required: true },
      Spell: { type: 'string', required: false },
      Damage: { type: 'string', required: false },
      Advantage: { type: 'string', required: false },
      Disadvantage: { type: 'string', required: false },
      // Combat item 1: Hand="off" attacks with the off-hand weapon
      // (Light weapons only, no ability modifier to its damage, once
      // per turn); Thrown="true" declares a thrown attack (the weapon
      // must have the thrown property; no distance is checked — that
      // is item 4); Cleave="true" spends a Cleave follow-up granted by
      // an earlier Cleave hit (real roll, no ability modifier, and the
      // second target must be within 5 feet of the first and within
      // reach — positioning is the DM's attestation until item 4
      // checks adjacency in the engine).
      Hand: { type: 'string', required: false },
      Thrown: { type: 'string', required: false },
      Cleave: { type: 'string', required: false },
      // Combat item 3, Tier 2: Bonus="true" declares a bonus-action
      // attack (GWM crit/kill, Polearm Master). It charges the bonus
      // action and does not consume an Attack-action swing.
      Bonus: { type: 'string', required: false },
      // Combat item 3, Tier 3: Ready="true" declares a readied attack
      // firing — a stored READY and an available reaction are
      // required, and the reaction is spent on the firing.
      Ready: { type: 'string', required: false }
    }
  },

  // Combat item 3, Tier 3: Dodge / Disengage / Help / Hide / Ready.
  // Dodge: attacks against the dodger at disadvantage until the
  // start of their next turn; Bonus="true" spends the bonus action
  // instead (Patient Defense). Disengage: opportunity attacks
  // against the mover are refused until their next turn; Bonus
  // variant covers Cunning Action / Step of the Wind. Help: the
  // named ally's next attack against the named target at advantage.
  // Hide: the hider's next attack at advantage (Stealth contests
  // stay DM-side until item 13); Bonus variant covers Cunning
  // Action. Ready: stores an action + trigger; firing is an ATTACK
  // with Ready="true" (reaction spent, no auto-detection).
  DODGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'string', required: false }
    }
  },

  DISENGAGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'string', required: false }
    }
  },

  HELP: {
    position: 'inline',
    fields: {
      Helper: { type: 'string', required: true },
      Target: { type: 'string', required: true },
      Ally: { type: 'string', required: true }
    }
  },

  HIDE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'string', required: false }
    }
  },

  READY: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Action: { type: 'string', required: true },
      Trigger: { type: 'string', required: true }
    }
  },

  MASTERY_SET: {
    position: 'inline',
    fields: {
      // Combat item 1: record a character's mastered weapons (comma-
      // separated, e.g. Weapons="Longsword, Warhammer"). Mastery
      // properties work only for weapons on this list. By the book
      // the list changes on a long rest; the engine does not enforce
      // that timing — the DM honors it (see the prompt line).
      Target: { type: 'string', required: true },
      Weapons: { type: 'string', required: true }
    }
  },

  TURN_ADVANCE: {
    position: 'inline',
    fields: {}
  },

  SPELL_CAST: {
    position: 'inline',
    fields: {
      Spell: { type: 'string', required: true },
      Level: { type: 'number', required: false },
      Caster: { type: 'string', required: false },
      Target: { type: 'string', required: false },
      Ready: { type: 'bool', required: false },
      Bonus: { type: 'bool', required: false },
      Targets: { type: 'string', required: false },
      Reaction: { type: 'bool', required: false },
      Choice: { type: 'string', required: false }
    }
  },

  // F5 surfacing — the Wild Magic report marker. Answers a Wild Magic
  // Surge offer the spell engine already made (a pending offer record
  // in session_config): the DM asks the player to roll, the player
  // reports, and the DM emits this marker with the reported die.
  // Spends no slot and casts nothing — it only feeds the reported die
  // into the hook the offer opened. D20 = the surge d20 (a 20 also
  // needs D100); D100 alone answers a Tides of Chaos forced roll.
  // D100Second + Choice (1 or 2) answer a Controlled Chaos roll-twice.
  // Refused when no offer is pending (the handler enforces that).
  WILD_MAGIC_REPORT: {
    position: 'inline',
    fields: {
      D20: { type: 'number', required: false },
      D100: { type: 'number', required: false },
      D100Second: { type: 'number', required: false },
      Choice: { type: 'number', required: false }
    }
  },

  // Display casting (combined build with item 8): a real cast aimed
  // at a spot, not a creature, as a display of power. Full cost
  // (slot + action, counterable). Target is free spot text ("floor
  // beside GobA"). Intimidate="true" makes the placement roll the
  // Intimidation check (Dc= required then); otherwise the roll is a
  // bare placement d20 (nat 1 mishap, nat 20 surge, else lands).
  // Beside names the creature the spot sits beside — the mishap
  // splash target; without it the splash category is unavailable.
  // Features is the DM-declared mishap/surge candidate list, used
  // only when no room is linked to the encounter ("name:kind" pairs,
  // comma-separated; kinds: flammable, water, secret, ...).
  DISPLAY: {
    position: 'inline',
    fields: {
      Spell: { type: 'string', required: true },
      Level: { type: 'number', required: false },
      Caster: { type: 'string', required: false },
      Target: { type: 'string', required: true },
      Intimidate: { type: 'bool', required: false },
      Dc: { type: 'number', required: false },
      Beside: { type: 'string', required: false },
      Features: { type: 'string', required: false }
    }
  },

  ENEMY_DISPLAY: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      Spell: { type: 'string', required: true },
      Level: { type: 'number', required: false },
      Target: { type: 'string', required: true },
      Intimidate: { type: 'bool', required: false },
      Dc: { type: 'number', required: false },
      Beside: { type: 'string', required: false },
      Features: { type: 'string', required: false }
    }
  },

  OPPORTUNITY_ATTACK: {
    position: 'inline',
    fields: {
      Attacker: { type: 'string', required: true },
      Target: { type: 'string', required: true }
    }
  },

  SET_COVER: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Cover: { type: 'string', required: true },
      // Phase B: the room feature the cover comes from. Optional so
      // fights outside a scene room (no feature list to check) keep
      // the pre-Phase-B grant; required in practice for a fight in a
      // linked scene room, where the handler validates it and denies
      // cover when the feature is not in that room.
      Feature: { type: 'string', required: false }
    }
  },

  // Scene layer wiring: link the current encounter to a room.
  // Scene=+Room= links an existing scene room; Name=+Features=+Exits=
  // creates a simple room and links it. Requires an active encounter.
  SET_ROOM: {
    position: 'inline',
    fields: {
      Scene: { type: 'number', required: false },
      Room: { type: 'string', required: false },
      Name: { type: 'string', required: false },
      Features: { type: 'string', required: false },
      Exits: { type: 'string', required: false }
    }
  },

  // Dungeon generation wiring: DM marker only — the DM's world decides
  // where dungeons are. Name is required; Purpose/Region/SiteEra come
  // from the DM system's world knowledge (never a player form);
  // party level/size come auto from the session party sheet.
  // Justification is required by the handler (not the schema) only
  // when a coherence flag is raised — a flagged scene is never
  // stored silently. Location is a location_id for deduplication.
  GENERATE_DUNGEON: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Purpose: { type: 'string', required: false },
      Region: { type: 'string', required: false },
      SiteEra: { type: 'string', required: false },
      Location: { type: 'number', required: false },
      Justification: { type: 'string', required: false },
      RoomCount: { type: 'int', required: false, min: 4 }
    }
  },

  // Time-evolution engine: DM proposes, system checks. Scene is a
  // scene id. Anomalies need Justification=; a cleared occupant can
  // never return, justified or not.
  EVOLVE_PLACE: {
    position: 'inline',
    fields: {
      Scene: { type: 'number', required: true },
      Occupants: { type: 'string', required: false },
      Use: { type: 'string', required: false },
      LootState: { type: 'string', required: false },
      Condition: { type: 'string', required: false },
      HazardFamily: { type: 'string', required: false },
      SiteEra: { type: 'string', required: false },
      Event: { type: 'string', required: false },
      Protected: { type: 'bool', required: false },
      Justification: { type: 'string', required: false },
      HistoricNote: { type: 'bool', required: false },
      ViaNetwork: { type: 'bool', required: false },
      PartyDeed: { type: 'bool', required: false }
    }
  },

  ROLL_REQUEST: {
    position: 'inline',
    fields: {
      Skill: { type: 'string', required: false },
      Ability: { type: 'string', required: false },
      Save: { type: 'string', required: false },
      DC: { type: 'number', required: true },
      Looks: { type: 'string', required: true },
      Actor: { type: 'string', required: false },
      Advantage: { type: 'string', required: false },
      Disadvantage: { type: 'string', required: false },
      // Combat item 8: a hearing-tagged request auto-fails for a
      // deafened roller (no roll, no pending).
      Hearing: { type: 'bool', required: false }
    }
  },

  // Perception pre-roll (2026-11-05): banked Perception at the dungeon
  // door. The DM banks one number per character at the door
  // (PERCEPTION_PREROLL) and reads the stored number in secret at a
  // hidden-layer check (PERCEPTION_USE) instead of asking for a roll.
  // Trigger is an enum: trap | secret_door | stealthed_enemy. Secret
  // doors use DC 15 in v1 (no DC is stored on hidden exits); trap DCs
  // come from the room's detectDc; a stealthed enemy's DC is its
  // Stealth total.
    // D4 Heroic Inspiration reroll (Family 6): the DM offers the reroll
  // inline after a reported d20; the player (or DM) accepts it. The
  // handler spends the pool and re-issues the SAME pending roll — the
  // new roll stands even if lower. One reroll per roll, enforced by
  // requestHeroicReroll.
  HEROIC_REROLL: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false } // 'Player' (default) or a companion name
    }
  },
PERCEPTION_PREROLL: {
    position: 'inline',
    fields: {
      Dungeon: { type: 'string', required: true }
    }
  },

  PERCEPTION_USE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Trigger: { type: 'enum', enum: ['trap', 'secret_door', 'stealthed_enemy'], required: true },
      DC: { type: 'number', required: true }
    }
  },

  // Help for ability checks (Tier 3 follow-up, audit item 2): the
  // working-together rule. Helper and ally must both be party
  // members; at most one scope (Skill/Ability/Save — Save refused,
  // Help never applies to saving throws); no scope means the
  // ally's next check of any kind.
  HELP_CHECK: {
    position: 'inline',
    fields: {
      Helper: { type: 'string', required: true },
      Ally: { type: 'string', required: true },
      Skill: { type: 'string', required: false },
      Ability: { type: 'string', required: false },
      Save: { type: 'string', required: false }
    }
  },

  // Phase 1 (v1.0.188): time and rest are system facts, not narration.
  // TIME_ADVANCE moves the world clock; REST applies recovery server-
  // side and advances the clock by the rest's duration. Handlers live
  // in restTimeService.js.
  TIME_ADVANCE: {
    position: 'inline',
    fields: {
      Hours: { type: 'number', required: false },
      Days: { type: 'number', required: false },
      Reason: { type: 'string', required: false }
    }
  },

  REST: {
    position: 'inline',
    fields: {
      Type: { type: 'enum', enum: ['short', 'long'], required: true },
      Actor: { type: 'string', required: false },
      Dice: { type: 'number', required: false }
    }
  },

  LOOT_DROP: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true },
      Source: { type: 'string', required: false }
    }
  },

  // Loot wiring (R-02): DM-driven discovery triggers. ITEM_REVEAL_ONE
  // when a magic item is first used in a fight (shows one thing);
  // ITEM_IDENTIFY when a short rest is spent focused on the item
  // (unlocks the rest, DMG p.136). Handlers live in
  // magicItemDiscoveryService.js; cursed items refuse both until attuned.
  ITEM_REVEAL_ONE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Item: { type: 'string', required: true }
    }
  },

  ITEM_IDENTIFY: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Item: { type: 'string', required: true }
    }
  },

  CONDITION_ADD: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Condition: {
        type: 'enum',
        enum: [
          'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
          'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
          'prone', 'restrained', 'stunned', 'unconscious',
          'exhaustion_1', 'exhaustion_2', 'exhaustion_3',
          'exhaustion_4', 'exhaustion_5', 'exhaustion_6'
        ],
        required: true
      },
      // Combat item 8: source identity for the two conditions whose
      // enforcement needs it (charmer for attack refusal, grappler
      // for escape DCs). Required by the handler, not the schema —
      // the schema stays permissive so the handler can refuse with
      // a targeted remedy instead of a generic parse failure.
      Charmer: { type: 'string', required: false },
      Grappler: { type: 'string', required: false }
    }
  },

  ESCAPE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Skill: { type: 'string', required: false },
      Dc: { type: 'number', required: false }
    }
  },

  CONDITION_REMOVE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Condition: { type: 'string', required: true }
    }
  },

  PROMISE_MADE: {
    position: 'inline',
    fields: {
      NPC: { type: 'string', required: true },
      Promise: { type: 'string', required: true },
      Weight: {
        type: 'enum',
        enum: ['trivial', 'minor', 'moderate', 'major', 'critical'],
        required: true
      },
      Deadline: { type: 'int', required: false, min: 1 }
    }
  },

  PROMISE_FULFILLED: {
    position: 'inline',
    fields: {
      NPC: { type: 'string', required: true },
      Promise: { type: 'string', required: true }
    }
  },

  NOTORIETY_GAIN: {
    position: 'inline',
    // Note: source/amount/category are lowercase in the existing contract.
    // Kept lowercase here so the schema matches what the prompt instructs.
    fields: {
      source: { type: 'string', required: true },
      amount: { type: 'int', required: true, min: 1, max: 50 },
      category: {
        type: 'enum',
        enum: ['criminal', 'political', 'arcane', 'religious', 'military'],
        required: true
      }
    }
  },

  NOTORIETY_LOSS: {
    position: 'inline',
    fields: {
      source: { type: 'string', required: true },
      amount: { type: 'int', required: true, min: 1, max: 50 }
    }
  },

  NPC_WANTS_TO_JOIN: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Race: { type: 'string', required: true },
      Gender: { type: 'string', required: true },
      Occupation: { type: 'string', required: true },
      Personality: { type: 'string', required: true },
      Reason: { type: 'string', required: true }
    }
  },

  BASE_DEFENSE_RESULT: {
    position: 'last',
    fields: {
      Threat: { type: 'int', required: true, min: 1 },
      Outcome: {
        type: 'enum',
        enum: ['repelled', 'damaged', 'captured', 'abandoned'],
        required: true
      },
      Narrative: { type: 'string', required: true }
    }
  },

  // Phase 3.7 SC-3.7.1 — marker-driven fortress threat origination.
  // AI DM emits this when narrative context warrants a threat against a
  // player-owned base; the handler in baseThreatService.js creates the
  // base_threats row directly. Replaces the world-event-tick path
  // (`generateThreatsForCampaign`) as the canonical origination
  // mechanism; the legacy path stays in place but is deprecated.
  //
  // Field semantics (per spec §2.3):
  //   BaseId       — which of the player's bases (handler validates ownership)
  //   EventType    — picked from RAID_CAPABLE_EVENTS keys; drives default
  //                  Source/Category fallback if those fields omitted
  //   Force        — attacker strength; drives raid-vs-siege determination
  //                  via SIEGE_FORCE_THRESHOLD (15 today)
  //   WarningDays  — game-days until deadline
  //   Source       — display label (optional; falls back to RAID_CAPABLE_EVENTS
  //                  sourceLabel handler-side per Q3)
  //   Category     — notoriety category enum (optional; falls back to event
  //                  type's default category handler-side per Q3)
  //   Reason       — narrative justification, stored on the threat row for
  //                  later prompt injection during the lifecycle
  //
  // Multi-instance per Q1 — pipeline's default loop handles multiple
  // FORTRESS_THREAT emissions per turn without a schema flag.
  FORTRESS_THREAT: {
    position: 'inline',
    fields: {
      BaseId: { type: 'int', required: true, min: 1 },
      EventType: {
        type: 'enum',
        enum: ['bandit_activity', 'war', 'undead_uprising', 'mercenary_incursion', 'cult_activity'],
        required: true
      },
      Force: { type: 'int', required: true, min: 1, max: 30 },
      WarningDays: { type: 'int', required: true, min: 1, max: 30 },
      Source: { type: 'string', required: false },
      Category: {
        type: 'enum',
        enum: ['criminal', 'political', 'arcane', 'religious', 'military'],
        required: false
      },
      Reason: { type: 'string', required: false }
    }
  },

  // ============================================================
  // Phase 3 SC-6.4d — Combat / mythic cluster (final SC-6.4 ship)
  // ============================================================
  //
  // Three new schemas for the mythic markers (MYTHIC_TRIAL, ITEM_AWAKEN,
  // MYTHIC_SURGE) — all single-instance, structured, no orchestration
  // coupling. Handlers in mythicService.js.
  //
  // COMBAT_START, COMBAT_END, BASE_DEFENSE_RESULT schemas already in
  // place (pre-Phase-3); SC-6.4d adds handlers in combatMarkerService.js
  // (new) and baseThreatService.js, removes the inline route dispatches.

  MYTHIC_TRIAL: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Description: { type: 'string', required: false },
      Outcome: { type: 'enum', enum: ['passed', 'failed', 'redirected'], required: false }
    }
  },

  ITEM_AWAKEN: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true },
      NewState: { type: 'enum', enum: ['awakened', 'exalted', 'mythic'], required: false },
      Deed: { type: 'string', required: false }
    }
  },

  MYTHIC_SURGE: {
    position: 'inline',
    fields: {
      Ability: { type: 'string', required: true },
      Cost: { type: 'int', required: false, min: 1 }
    }
  },

  // Phase 3 SC-4 — added to MARKER_SCHEMAS so the standing-scalar marker
  // pipeline (markerPipeline.js) can validate and dispatch piety changes.
  // Replaces dmSessionService::detectPietyChange's silent-drop behavior
  // with schema validation + correction-loop feedback when malformed.
  // Amount is signed (no min/max) — piety can decrease.
  PIETY_CHANGE: {
    position: 'inline',
    fields: {
      Deity: { type: 'string', required: true },
      Amount: { type: 'int', required: true },
      Reason: { type: 'string', required: false }
    }
  },

  // ============================================================
  // Phase 3 SC-6.4 — Survival + crafting cluster
  // ============================================================
  //
  // Handlers registered in survivalService.js, weatherService.js,
  // craftingService.js. Inline dispatch in routes/dmSession.js replaced
  // with handlerResults extraction (preserves the existing client
  // contract — survivalEvents/craftingEvents arrays still populate
  // identically; client uses .length > 0 as a refresh trigger via
  // DMSession.jsx:869).
  //
  // SHELTER_FOUND migrated first per the Phase 4 prep flag in the Q6
  // survey: Phase 4's AI-behavior diagnostic work will hook the
  // shelter-fixation analysis through the marker pipeline.
  //
  // SWIM is schema-only (no handler) — the legacy detect function was
  // exported and imported but never invoked from any side-effect path.
  // Schema add buys validation + correction-loop feedback without a
  // handler since there's no service function to wire up. Same shape
  // as SC-6.3's parked prelude markers (schema without handler is a
  // legitimate end-state when the marker has no side-effect target).
  SHELTER_FOUND: {
    position: 'inline',
    fields: {
      Type: { type: 'enum', enum: ['cave', 'building', 'tent', 'bedroll', 'overhang'], required: true },
      Quality: { type: 'enum', enum: ['adequate', 'good', 'excellent'], required: false }
    }
  },
  WEATHER_CHANGE: {
    position: 'inline',
    fields: {
      Type: { type: 'string', required: true },
      Duration_Hours: { type: 'int', required: false, min: 1 }
    }
  },
  // Cold exposure (v1, 2026-10-28): COLD_SCENE sets the scene Cold
  // Level context that TIME_ADVANCE then spends; COLD_WET sets a
  // Wet/Soaked status (depth-aware in the fiction: ankle-deep = Wet,
  // immersion = Soaked). Handlers live in coldExposureService.js.
  // The DM prompt does not yet teach these markers (handover open
  // item) — they work through the pipeline and direct service calls.
  COLD_SCENE: {
    position: 'inline',
    fields: {
      BaseLevel: { type: 'int', required: false },
      Campfire: { type: 'bool', required: false },
      InsulatedTent: { type: 'bool', required: false },
      Blizzard: { type: 'bool', required: false },
      MagicalBlizzard: { type: 'bool', required: false },
      Elevation: { type: 'int', required: false },
      ForceGoliath: { type: 'bool', required: false }
    }
  },
  COLD_WET: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Status: { type: 'enum', enum: ['dry', 'wet', 'soaked'], required: true }
    }
  },
  EAT: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true }
    }
  },
  DRINK: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true }
    }
  },
  FORAGE: {
    position: 'inline',
    fields: {
      Terrain: { type: 'string', required: false },
      Result: { type: 'enum', enum: ['success', 'partial', 'failure'], required: false },
      Food: { type: 'int', required: false, min: 0 },
      Water: { type: 'int', required: false, min: 0 }
    }
  },
  SWIM: {
    position: 'inline',
    fields: {
      Duration: { type: 'string', required: false }
    }
  },
  CRAFT_PROGRESS: {
    position: 'inline',
    fields: {
      Hours: { type: 'int', required: true, min: 1 }
    }
  },
  RECIPE_FOUND: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Source: { type: 'string', required: false }
    }
  },
  MATERIAL_FOUND: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Quantity: { type: 'int', required: false, min: 1 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: false }
    }
  },
  RECIPE_GIFT: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Category: { type: 'enum', enum: ['food', 'potion', 'weapon', 'armor', 'adventuring_gear', 'poison', 'scroll', 'ammunition', 'shelter'], required: true },
      Description: { type: 'string', required: false },
      Materials: { type: 'string', required: false },
      Tools: { type: 'string', required: false },
      DC: { type: 'int', required: false, min: 5, max: 30 },
      Hours: { type: 'int', required: false, min: 1 },
      Ability: { type: 'string', required: false },
      OutputName: { type: 'string', required: false },
      OutputDesc: { type: 'string', required: false },
      GiftedBy: { type: 'string', required: false }
    }
  },

  // Phase 3 SC-5 — DM Mode bond-shift marker. Replaces
  // dmModeService::detectBondShifts's silent-skip-on-no-op pattern with
  // schema validation. Warmth and Trust are independently signed deltas
  // bounded to [-5, +5] (matches the per-turn delta range — the absolute
  // warmth/trust scores are clamped to [-5, +5] by the abstraction's
  // range config; per-shift deltas in [-5, +5] keep the marker schema
  // narrow enough to catch obvious AI emit errors).
  BOND_SHIFT: {
    position: 'last',
    fields: {
      From: { type: 'string', required: true },
      To: { type: 'string', required: true },
      Warmth: { type: 'int', required: false, min: -5, max: 5 },
      Trust: { type: 'int', required: false, min: -5, max: 5 },
      Reason: { type: 'string', required: false }
    }
  },

  // ============================================================
  // Phase 3 SC-6.3 — Prelude markers (validation-only, no handlers)
  // ============================================================
  //
  // 19 schemas added so the pipeline can validate prelude marker shapes
  // and surface correction-loop feedback when the AI emits malformed
  // markers. Per the SC-6.3 parking decision (DECISION_LOG entry
  // 2026-05-04): all 19 markers are PARKED from per-handler dispatch
  // because the existing `processMarkersForSession` orchestrator in
  // preludeSessionService.js enforces ordering invariants between
  // markers (AGE_ADVANCE → HP_CHANGE for max_hp; CANON_FACT_RETIRE →
  // CANON_FACT for retire-then-record; CHAPTER_PROMISE → AGE_ADVANCE
  // for chapter check) plus aggregates returns into a single response
  // payload (npcsCreated, capViolations, offeredEmergences). Per-marker
  // pipeline dispatch doesn't fit those shapes today.
  //
  // Side-effect dispatch stays consumer-side via processMarkersForSession
  // + the existing detect-functions in preludeMarkerDetection.js. The
  // pipeline contributes correction-loop feedback ONLY (which prelude
  // didn't have before SC-6.3).
  //
  // Field shapes mirror the canonical form documented in each detect
  // function. Backward-compat aliases (e.g. CLASS_HINT's `class_id=`
  // alongside `class=`) are NOT in the schema — they continue to work
  // through the detect function, but malformed canonical-form emissions
  // get correction feedback. This is an intentional asymmetry: schemas
  // tighten the contract for the AI; detect-functions keep the legacy
  // tolerance for old transcripts.
  //
  // Two markers use bareword/free-text bodies that the parseMarkerBody
  // field-parser can't extract (NEXT_SCENE_WEIGHT: heavy, presence-only
  // forms of THEME_COMMITMENT_OFFERED / PRELUDE_END). Their schemas use
  // `fields: {}` — present-when-emitted validation, no field extraction.

  AGE_ADVANCE: {
    position: 'inline',
    fields: {
      years: { type: 'int', required: true, min: 1 }
    }
  },

  CHAPTER_END: {
    position: 'inline',
    fields: {
      summary: { type: 'string', required: true }
    }
  },

  // SESSION_END_CLIFFHANGER's three legacy forms (bare quoted, text=, bare body)
  // collapse to one schema-validated canonical form: text="...". Forms A and C
  // continue to parse via the detect function but won't validate against the
  // schema. Per spec §3.2 the schema tightens the AI-facing contract; legacy
  // tolerance is fine for old transcripts and during transition.
  SESSION_END_CLIFFHANGER: {
    position: 'inline',
    fields: {
      text: { type: 'string', required: false }
    }
  },

  NPC_CANON: {
    position: 'inline',
    fields: {
      name: { type: 'string', required: true },
      relationship: { type: 'string', required: false },
      status: { type: 'string', required: false }
    }
  },

  LOCATION_CANON: {
    position: 'inline',
    fields: {
      name: { type: 'string', required: true },
      type: { type: 'string', required: false },
      is_home: { type: 'bool', required: false }
    }
  },

  // delta is signed; the detect function rejects 0 explicitly. Schema accepts
  // 0 (no min/max) — the detect function still drops 0-deltas before applying.
  HP_CHANGE: {
    position: 'inline',
    fields: {
      // Combat item 7: delta is required only for declared changes.
      // A table cause (Fall/Trap/Hazard) replaces it — the engine rolls.
      // Target names a companion; without it the PC takes it.
      delta: { type: 'int', required: false },
      reason: { type: 'string', required: false },
      Fall: { type: 'int', required: false, min: 0 },
      Trap: { type: 'string', required: false },
      Hazard: { type: 'string', required: false },
      Severity: { type: 'string', required: false },
      Type: { type: 'string', required: false },
      Save: { type: 'string', required: false },
      Target: { type: 'string', required: false }
    }
  },

  CHAPTER_PROMISE: {
    position: 'inline',
    fields: {
      theme: { type: 'string', required: false },
      question: { type: 'string', required: false }
    }
  },

  // Presence-only marker. Body may carry stray fields the AI improvises;
  // schema doesn't extract them (the server recomputes the offer
  // authoritatively via preludeThemeService.buildThemeOffer).
  THEME_COMMITMENT_OFFERED: {
    position: 'inline',
    fields: {}
  },

  // Bareword body (`heavy|standard|light`) doesn't fit the `field=value`
  // parser. Schema validates presence; the detect function extracts the
  // value separately via its own regex.
  NEXT_SCENE_WEIGHT: {
    position: 'inline',
    fields: {}
  },

  STAT_HINT: {
    position: 'inline',
    fields: {
      stat: { type: 'enum', enum: ['str', 'dex', 'con', 'int', 'wis', 'cha'], required: true },
      magnitude: { type: 'int', required: false, min: 1, max: 2 },
      reason: { type: 'string', required: false }
    }
  },

  SKILL_HINT: {
    position: 'inline',
    fields: {
      skill: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  CLASS_HINT: {
    position: 'inline',
    fields: {
      class: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  THEME_HINT: {
    position: 'inline',
    fields: {
      theme: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  ANCESTRY_HINT: {
    position: 'inline',
    fields: {
      feat_id: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  CANON_THREAD: {
    position: 'inline',
    fields: {
      kind: {
        type: 'enum',
        enum: [
          'unresolved_loss', 'blood_debt', 'unfulfilled_oath', 'unpaid_crime',
          'unfinished_relationship', 'held_object', 'held_secret'
        ],
        required: true
      },
      subject: { type: 'string', required: true },
      condition: { type: 'string', required: true },
      weight: { type: 'enum', enum: ['minor', 'notable', 'major'], required: false }
    }
  },

  CANON_FACT: {
    position: 'inline',
    fields: {
      subject: { type: 'string', required: true },
      category: {
        type: 'enum',
        enum: ['npc', 'location', 'event', 'relationship', 'trait', 'item'],
        required: true
      },
      fact: { type: 'string', required: true }
    }
  },

  CANON_FACT_RETIRE: {
    position: 'inline',
    fields: {
      subject: { type: 'string', required: true },
      fact_contains: { type: 'string', required: true }
    }
  },

  DEPARTURE: {
    position: 'inline',
    fields: {
      reason: { type: 'string', required: false },
      tone: { type: 'string', required: false }
    }
  },

  // Presence-only marker. The detect function tolerates an optional body
  // (`[PRELUDE_END: ...]`), but the canonical form is bare brackets.
  PRELUDE_END: {
    position: 'inline',
    fields: {}
  },

  // Combat item 2 (2026-10-30): these markers had handlers but NO
  // schema, so processResponseMarkers never dispatched them —
  // validateDmMarkers only iterates MARKER_SCHEMAS keys. ATTACK and
  // MASTERY_SET (combat item 1) were in the same state; adding them
  // here makes the pipeline actually fire them instead of silently
  // dropping them. Field names match the handler reads exactly
  // (capitalized), so parsed keys line up with parsed.Attacker etc.
  ATTACK: {
    position: 'inline',
    fields: {
      Attacker: { type: 'string', required: true },
      Target: { type: 'string', required: true },
      Spell: { type: 'string', required: false },
      Damage: { type: 'string', required: false },
      Hand: { type: 'string', required: false },
      Thrown: { type: 'bool', required: false },
      Cleave: { type: 'bool', required: false },
      // Combat item 3, Tier 2 (see the first ATTACK block — this
      // dispatch block is the one the pipeline actually parses, so
      // every field must be listed here too, or it is stripped
      // before the handler ever sees it).
      Bonus: { type: 'bool', required: false },
      // Combat item 3, Tier 3: Ready="true" declares a readied attack
      // firing — a stored READY and an available reaction required.
      Ready: { type: 'bool', required: false },
      Advantage: { type: 'bool', required: false },
      Disadvantage: { type: 'bool', required: false },
      Ally: { type: 'bool', required: false },
      AllyAdjacent: { type: 'bool', required: false },
      Smite: { type: 'int', required: false, min: 1, max: 9 },
      SmiteFiend: { type: 'bool', required: false }
    }
  },

  MASTERY_SET: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Weapons: { type: 'string', required: true }
    }
  },

  RAGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      End: { type: 'bool', required: false }
    }
  },

  INSPIRATION: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bard: { type: 'string', required: false },
      Spend: { type: 'bool', required: false }
    }
  },

  SECOND_WIND: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true }
    }
  },

  LAY_ON_HANDS: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Amount: { type: 'int', required: true, min: 1 },
      Healer: { type: 'string', required: false }
    }
  },

  // Mechanics hooks, Family 8 — C-kind first slice (design §3.8, D1).
  // Handlers in subclassMarkerService.js, registered at module load.
  // BEND_LUCK: reaction, spend 1 Sorcery Point, roll 1d4 as a bonus or
  // penalty on another creature's d20 Test. TIDES_OF_CHAOS: advantage
  // on one d20 Test; spent until a slotted Sorcerer spell (automatic
  // surge) or a Long Rest. PRESERVE_LIFE: Channel Divinity, Magic
  // action; Allocations="Name=hp,..." split among Bloodied creatures,
  // none restored above half maximum, total 5 x Cleric level.
  // TAMED_SURGE: once per Long Rest, choose a surge row except the
  // final row (97-00 Boon). TELEPATHIC_SPEECH / AWAKENED_MIND:
  // bonus-action telepathic link (Amendment 2 §2 #20/#22).
  // HOUND_OF_ILL_OMEN / ACCURSED_SPECTER / FAITHFUL_SUMMONS: the C
  // shells whose creatures ride the combat_allies row (Amendment 2
  // §4 #14) — the shell spends the resource, entityService creates
  // the creature.
  BEND_LUCK: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Roll: { type: 'string', required: true },
      Direction: { type: 'enum', enum: ['bonus', 'penalty'], required: true }
    }
  },
  TIDES_OF_CHAOS: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true }
    }
  },
  PRESERVE_LIFE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Allocations: { type: 'string', required: true }
    }
  },
  TAMED_SURGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Row: { type: 'string', required: true }
    }
  },
  TELEPATHIC_SPEECH: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Creature: { type: 'string', required: true }
    }
  },
  AWAKENED_MIND: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Creature: { type: 'string', required: true }
    }
  },
  HOUND_OF_ILL_OMEN: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Creature: { type: 'string', required: true }
    }
  },
  ACCURSED_SPECTER: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Slain: { type: 'string', required: false }
    }
  },
  FAITHFUL_SUMMONS: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Beasts: { type: 'string', required: true }
    }
  },

  // Attunement (Amendment 1 §3.3): schemas ONLY in this family. The
  // ATTUNE / UNATTUNE handlers live in attunementService.js, owned by
  // the attunement family — a schema with no handler is validation-only
  // (correction-loop feedback) until that file lands and is imported
  // for side effect in routes/dmSession.js. Do not register handlers
  // for these keys here.
  ATTUNE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true }
    }
  },
  UNATTUNE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true }
    }
  },

  // Artificer base class: handlers in artificerService.js. Target is
  // optional on all of these — omitted means the PC (the handler
  // resolves a companion by name when Target names one).
  ARTIFICER_LEARN_PLAN: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Plan: { type: 'string', required: true },
      Detail: { type: 'string', required: false }
    }
  },
  ARTIFICER_REPLACE_PLAN: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Old: { type: 'string', required: true },
      Plan: { type: 'string', required: true },
      Detail: { type: 'string', required: false }
    }
  },
  ARTIFICER_CREATE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Plans: { type: 'string', required: true },
      Tools: { type: 'bool', required: false },
      Attune: { type: 'bool', required: false }
    }
  },
  ARTIFICER_ATTUNE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true }
    }
  },
  ARTIFICER_UNATTUNE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true }
    }
  },
  ARTIFICER_FLASH: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Total: { type: 'int', required: true },
      DC: { type: 'int', required: true }
    }
  },
  ARTIFICER_TINKER: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true },
      Tools: { type: 'bool', required: false }
    }
  },
  ARTIFICER_RIGHT_TOOL: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Tool: { type: 'string', required: true }
    }
  },
  ARTIFICER_CHARGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true },
      Slot: { type: 'int', required: true }
    }
  },
  ARTIFICER_DRAIN: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true }
    }
  },
  ARTIFICER_TRANSMUTE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Item: { type: 'string', required: true },
      Plan: { type: 'string', required: true }
    }
  },
  ARTIFICER_STORE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Spell: { type: 'string', required: true },
      Level: { type: 'int', required: true },
      CastTime: { type: 'string', required: true },
      MaterialConsumed: { type: 'bool', required: true }
    }
  },
  ARTIFICER_RELEASE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Turn: { type: 'string', required: true }
    }
  },
  ARTIFICER_HOMUNCULUS: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Slot: { type: 'int', required: true },
      AttackBonus: { type: 'int', required: true }
    }
  },
  ARTIFICER_ORIGIN: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      Setting: { type: 'string', required: false },
      Region: { type: 'string', required: false },
      Explanation: { type: 'string', required: true }
    }
  },
  ARTIFICER_CHEAT_DEATH: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false },
      KilledOutright: { type: 'bool', required: false }
    }
  },

  // Combat item 3, Tier 1: spends one Action Surge use and grants one
  // more action this turn in the turn ledger. Without this schema the
  // pipeline never dispatches the handler (item 2 lesson).
  ACTION_SURGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true }
    }
  },

  // Combat item 3, Tier 3 (dispatch block — the pipeline parses
  // this one, so every field must be listed here too).
  DODGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'bool', required: false },
      Ready: { type: 'bool', required: false }
    }
  },

  DISENGAGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'bool', required: false },
      Ready: { type: 'bool', required: false }
    }
  },

  HELP: {
    position: 'inline',
    fields: {
      Helper: { type: 'string', required: true },
      Target: { type: 'string', required: true },
      Ally: { type: 'string', required: true },
      Ready: { type: 'bool', required: false }
    }
  },

  HIDE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'bool', required: false },
      Ready: { type: 'bool', required: false },
      Stealth: { type: 'number', required: false },
      StealthDie: { type: 'number', required: false },
      End: { type: 'bool', required: false }
    }
  },

  SEARCH: {
    position: 'inline',
    fields: {
      Searcher: { type: 'string', required: true },
      Target: { type: 'string', required: true },
      Perception: { type: 'number', required: false },
      PerceptionDie: { type: 'number', required: false }
    }
  },

  READY: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Action: { type: 'string', required: true },
      Trigger: { type: 'string', required: true },
      Spell: { type: 'string', required: false },
      Level: { type: 'number', required: false }
    }
  },

  // Combat item 4, movement v1 (zones): ZONES declares the fight's
  // areas + foot-cost edges (+ optional starting placements);
  // MOVE walks the graph on a turn movement budget; DASH doubles
  // this turn's budget (Bonus="true" is the Cunning Action bridge).
  ZONES: {
    position: 'inline',
    fields: {
      Zones: { type: 'string', required: true },
      Edges: { type: 'string', required: false },
      Places: { type: 'string', required: false }
    }
  },
  MOVE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      To: { type: 'string', required: true },
      Distance: { type: 'number', required: false },
      Difficult: { type: 'bool', required: false },
      // Scene layer wiring: a declared Room= re-links the encounter
      // to that room after a successful move (same scene as the
      // current link, or Scene= when given). No Room= means no
      // re-link — zone names are not room keys.
      Room: { type: 'string', required: false },
      Scene: { type: 'number', required: false }
    }
  },
  DASH: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Bonus: { type: 'bool', required: false }
    }
  },
  // Combat item 5: enemy action economy markers.
  MULTIATTACK: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      Attacks: { type: 'string', required: true }
    }
  },
  LEGENDARY_SPEND: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      Cost: { type: 'number', required: false },
      Total: { type: 'number', required: false },
      Effect: { type: 'string', required: false }
    }
  },
  LAIR_ACTION: {
    position: 'inline',
    fields: {
      Lair: { type: 'string', required: true },
      Effect: { type: 'string', required: true }
    }
  },
  ENEMY_SLOTS: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      Slots: { type: 'string', required: true }
    }
  },
  ENEMY_CAST: {
    position: 'inline',
    fields: {
      Enemy: { type: 'string', required: true },
      Spell: { type: 'string', required: true },
      Level: { type: 'number', required: false },
      Dc: { type: 'number', required: false },
      Bonus: { type: 'bool', required: false },
      Legendary: { type: 'bool', required: false },
      Cost: { type: 'number', required: false },
      Target: { type: 'string', required: false },
      Targets: { type: 'string', required: false },
      Reaction: { type: 'bool', required: false },
      AtkBonus: { type: 'number', required: false },
      CasterLevel: { type: 'number', required: false },
      Choice: { type: 'string', required: false }
    }
  },
  // Lair durability (migration 099): LAIR_ACTION stays the DM-declared
  // layer; these markers drive the background durability layer. Lair is
  // a free key (e.g. "Ember Cave"), never an enemy name — durability is
  // keyed by lair, not by any boss row.
  LAIR_CREATE: {
    position: 'inline',
    fields: {
      Lair: { type: 'string', required: true },
      Name: { type: 'string', required: false },
      MaxHp: { type: 'number', required: false },
      Features: { type: 'string', required: false },
      Exits: { type: 'string', required: false },
      Scene: { type: 'number', required: false },
      Room: { type: 'string', required: false }
    }
  },
  LAIR_DAMAGE: {
    position: 'inline',
    fields: {
      Lair: { type: 'string', required: true },
      Amount: { type: 'number', required: true },
      Source: { type: 'string', required: false }
    }
  },
  LAIR_STABILIZE: {
    position: 'inline',
    fields: {
      Lair: { type: 'string', required: true },
      Method: { type: 'enum', enum: ['magic', 'mechanical'], required: true },
      Amount: { type: 'number', required: false }
    }
  },
  LAIR_HAZARD_ROLL: {
    position: 'inline',
    fields: {
      Lair: { type: 'string', required: true }
    }
  }
};

// ---------------------------------------------------------------------------
// Parsing — tolerant but validated
// ---------------------------------------------------------------------------

/**
 * Match a single marker body in text. Returns the raw key=value blob or
 * null if the named marker isn't present.
 *
 *   extractMarkerBody("...[LOOT_DROP: Item="Gold" Source="chest"]...", "LOOT_DROP")
 *   → 'Item="Gold" Source="chest"'
 *
 * Returns all matches when `all=true`.
 */
export function extractMarkerBodies(text, markerName, { all = false } = {}) {
  if (!text || typeof text !== 'string') return all ? [] : null;
  const re = new RegExp(`\\[${markerName}(?:\\s*:\\s*([^\\]]*))?\\]`, all ? 'gi' : 'i');
  if (!all) {
    const m = re.exec(text);
    if (!m) return null;
    return (m[1] || '').trim();
  }
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push((m[1] || '').trim());
  }
  return out;
}

/**
 * Pull a single `field=value` out of a body string. Tolerates three quote
 * styles (", ', bare token) and surrounding whitespace. Returns null if
 * the field is absent.
 */
function extractField(body, fieldName) {
  // Field names may be CamelCase or snake_case or lowercase — match
  // case-insensitively so schema misalignment from the AI doesn't drop data.
  const re = new RegExp(`\\b${fieldName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,\\]]+))`, 'i');
  const m = re.exec(body);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

/**
 * Parse a marker body against its schema. Returns:
 *   { ok: true, data: { ...fields } }
 *   { ok: false, errors: [{ field, reason }] }
 */
export function parseMarkerBody(body, schemaKey) {
  const schema = MARKER_SCHEMAS[schemaKey];
  if (!schema) return { ok: false, errors: [{ field: '*', reason: `Unknown marker schema: ${schemaKey}` }] };

  const data = {};
  const errors = [];

  for (const [fieldName, spec] of Object.entries(schema.fields)) {
    const raw = extractField(body || '', fieldName);

    if (raw === null || raw === '') {
      if (spec.required) {
        errors.push({ field: fieldName, reason: 'required field missing' });
      }
      continue;
    }

    if (spec.type === 'int') {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) {
        errors.push({ field: fieldName, reason: `expected integer, got "${raw}"` });
        continue;
      }
      if (spec.min != null && n < spec.min) {
        errors.push({ field: fieldName, reason: `must be ≥ ${spec.min}, got ${n}` });
        continue;
      }
      if (spec.max != null && n > spec.max) {
        errors.push({ field: fieldName, reason: `must be ≤ ${spec.max}, got ${n}` });
        continue;
      }
      data[fieldName] = n;
    } else if (spec.type === 'enum') {
      const lower = String(raw).toLowerCase();
      const match = spec.enum.find(v => v.toLowerCase() === lower);
      if (!match) {
        errors.push({
          field: fieldName,
          reason: `expected one of {${spec.enum.join('|')}}, got "${raw}"`
        });
        continue;
      }
      data[fieldName] = match;
    } else if (spec.type === 'bool') {
      data[fieldName] = /^true$/i.test(raw);
    } else {
      data[fieldName] = String(raw);
    }
  }

  return errors.length === 0
    ? { ok: true, data }
    : { ok: false, errors };
}

/**
 * Try to parse ALL instances of a marker in text. Returns an array of
 * results, one per marker instance:
 *   [{ ok: true, data }, { ok: false, errors, rawBody }, ...]
 */
export function parseAllMarkers(text, schemaKey) {
  const bodies = extractMarkerBodies(text, schemaKey, { all: true });
  return bodies.map(body => {
    const result = parseMarkerBody(body, schemaKey);
    if (!result.ok) result.rawBody = body;
    return result;
  });
}

// ---------------------------------------------------------------------------
// Correction feedback formatting
// ---------------------------------------------------------------------------

/**
 * Build a short correction note the next prompt can inject as a [SYSTEM]
 * line. Invisible to the player (stripped during rendering). Gives the
 * AI a concrete schema violation to fix rather than a vague "try again".
 *
 * Multiple failures in the same turn are consolidated into one note.
 *
 *   formatCorrectionNote('PROMISE_MADE', { field: 'Weight', reason: 'expected one of {trivial|minor|moderate|major|critical}, got "huge"' })
 *   → '[SYSTEM] Your last [PROMISE_MADE] marker didn\'t record: Weight expected one of {trivial|minor|moderate|major|critical}, got "huge". If this promise mattered, re-emit the marker correctly in this turn.'
 */
export function formatCorrectionNote(schemaKey, errors) {
  if (!Array.isArray(errors)) errors = [errors];
  const parts = errors.map(e => `${e.field} ${e.reason}`);
  return `[SYSTEM] Your last [${schemaKey}] marker didn't record: ${parts.join('; ')}. If this mattered, re-emit the marker correctly in this turn. The schema is in your system prompt; follow it exactly.`;
}

/**
 * Convenience — given a text response and a list of (schemaKey, parseResult)
 * pairs, produce a single combined correction message ready to inject at the
 * top of the next system turn. Returns null when no failures to report.
 */
export function buildCorrectionMessage(failures) {
  if (!failures || failures.length === 0) return null;
  const lines = failures.map(f => formatCorrectionNote(f.schemaKey, f.errors));
  return lines.join('\n');
}

/**
 * Run schema validation against every marker appearing in an AI response.
 * Returns:
 *   { validByKey: { SCHEMA_KEY: [ parsed, ... ] },
 *     failures:   [ { schemaKey, errors, rawBody }, ... ] }
 *
 * `validByKey` is purely informational — existing call sites (for
 * back-compat) continue to use their own regex detectors for the actual
 * business logic. The VALUE of this function is the `failures` array:
 * any marker the AI emitted that the schema rejects. These get stashed
 * on session_config.pendingMarkerCorrections and surfaced on the next
 * turn's prompt so the AI can re-emit.
 *
 * Player never sees any of this — the correction lives in the system
 * prompt, stripped from display by the existing marker-stripping layer.
 */
export function validateDmMarkers(text) {
  if (!text || typeof text !== 'string') {
    return { validByKey: {}, failures: [] };
  }
  const validByKey = {};
  const failures = [];
  for (const schemaKey of Object.keys(MARKER_SCHEMAS)) {
    const results = parseAllMarkers(text, schemaKey);
    if (results.length === 0) continue;
    const valid = [];
    for (const r of results) {
      if (r.ok) {
        valid.push(r.data);
      } else {
        failures.push({ schemaKey, errors: r.errors, rawBody: r.rawBody });
      }
    }
    if (valid.length > 0) validByKey[schemaKey] = valid;
  }
  return { validByKey, failures };
}
