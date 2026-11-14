# Report — campaign-plan live check: campaign-plan generation on the local model

Builder: Claude Code (Sonnet 5.5). Brief: `docs/pm/campaign-plan-live-check/BRIEF.md` (authorized 2026-11-14).
Branch `phase-4-hybrid-combat`, PC repo `E:\DnD Meta Game\dnd-meta-game`. Verify job: **no version bump, no product code changed.**
Commit: `df61df0` (the build); a follow-up commit adds this line.

## Understanding
The project is a solo D&D 2024 "forever game": one human player character, with the DM, NPCs, companions and enemies all played by an AI, which is gemma4:12b running offline through Ollama on Zach's PC. The MVP is core play inside a one-shot test campaign (Embervale).

This job asks one question: **when a player asks the game to generate a campaign plan, does it work on the local model, and what does the result look like?** The local-model-only job ported the generator to gemma4:12b but never ran it. This is evidence, not a gate: I generate two plans through the real path, report them in full, and judge them honestly. The brief sets no pass/fail bar on quality.

**Where my understanding differs from the brief:** the brief's item 1 says generate "from a plain seed (e.g. 'a Sword Coast campaign, levels 1–5')". **The generator has no seed or prompt input.** It takes a campaign (name, description, setting, tone, starting location) and a character (name, race, class, background, level, backstory). A level range is not a field; the service passes only the *character's* level. I expressed each seed as a campaign description and a matching character. This does not change the path; it is how a player reaches it.

## Verdict
**Generation works end to end on gemma4:12b, offline, with no key (BUILT + GREEN for a verify job: Files 245/245 green, assertions 19,557 passed, 0 failed).** Both runs returned HTTP 200 in about 36–40 seconds with a complete plan that parsed and stored. **Quality: a usable skeleton, not a finished campaign** (details and caveats below). Not a gate: Zach's own `npm test` on the PC gates it.

## Item 0 — the path mapped
| Layer | Where | Fact |
|---|---|---|
| Player UI | `client/src/components/CampaignPlanPage.jsx:353` ("Generate" button); `CampaignsPage.jsx:204` (step 4 of the create-campaign pipeline) and `:578` | `POST /api/campaign/:id/plan/generate` with `{ character_id }`. The campaign-create pipeline calls it automatically after create (and after backstory parsing). |
| Route | `server/routes/campaign.js:192` | Requires `character_id` (400 without). Calls the service, returns the plan as JSON; any error goes to `handleServerError`. |
| Service | `server/services/campaignPlanService.js:21` `generateCampaignPlan(campaignId, characterId)` | Loads the campaign and character, skips generation if the campaign already has an `imported` plan, builds the prompt, calls the model, parses, stores in `campaigns.campaign_plan`, then creates merchant inventory rows from the plan. |
| Model call | `campaignPlanService.js:52-62` | `loggedChat(…, 'generation', 16000, true)`: **role `generation`** (`server/services/localModels.js`) → **gemma4:12b**, token budget 16,000, raw reply (no cleanup). One call, `maxRetries` 3. |
| Input | `buildPlanningPrompt` (`:290`) | The campaign description (the "#1 priority" vision), name, setting, tone, starting location; the character's name, race, class, background, level, backstory, and parsed backstory elements (NPCs, places, factions, hooks) if present; recruited companions. **Fixed text:** "Year: 1350 DR" and a "HISTORICAL CONTEXT FOR 1350 DR" list (Harpers, Zhentarim, Thay, Sword Coast orcs, Waterdeep, Baldur's Gate, Cult of the Dragon, Cormyr). |
| Promised output | the prompt's JSON schema (`:358-`) | `main_quest` (title, summary, hook, stakes, ≤3 acts), `world_state`, `world_timeline.events` (≥5), `npcs` (6–8), `potential_companions` (3–4), `locations` (5–6), `merchants`, `factions` (3–4), `side_quests` (4–5), `themes`, `dm_notes`. |
| Parser | `parseAIResponse` (`:540`) via `extractLLMJson` | Tolerant: strips fences, repairs trailing commas, **and substitutes defaults for any missing top-level section** (`main_quest` falls back to "Untitled Quest" with empty fields). It never fails on a missing section. |

## The two runs
Driven by `tests/live/campaign-plan-live.mjs` (`npm run test:campaign-plan`): the **real** Express campaign router, the real service, `aiCallLogger`, `llm.js` and Ollama, against a throwaway database (`.test-tmp/plan-live.db`). The campaign was created through `POST /api/campaign`; the character row was inserted directly. Model and context: gemma4:12b, `num_ctx` 65,536. Token counts and latency are read from the game's own `ai_call_log`.

| | Run A | Run B |
|---|---|---|
| Seed | Plain: Sword Coast, levels 1–5 | Different: Moonsea / Anauroch frontier, levels 5–10 |
| Campaign | "TEST_PLAN A — The Ember Road", tone *heroic fantasy*, start *Waterdeep*. Description: "A Sword Coast campaign for levels 1-5. A caravan road between Waterdeep and Baldur's Gate has gone quiet, and the party is hired to find out why." | "TEST_PLAN B — The Salt Crown", tone *dark and political*, start *Mulmaster*. Description: "A dark, slow-burning intrigue campaign for levels 5-10 on the Moonsea shore and the edge of Anauroch. A failing mining town is being quietly bought up by someone who never shows their face." |
| Character (invented) | Brannoch Vael, Human Fighter, Soldier, level 1. Backstory: "Brannoch served three years in the Waterdeep city guard under Captain Ilsa Dornwright, who vouched for him when he left. His younger brother Tavin, a caravan driver, stopped writing two months ago." | Ysolde Marrek, Half-Elf Warlock, Criminal, level 5. Backstory: "Ysolde ran contraband salt out of Hillsfar until a patron she has never named paid off her debts. Her old partner, Osric Fenn, took the fall for her and is still in a Zhentarim cell in Zhentil Keep." |
| Model / role | gemma4:12b / generation | gemma4:12b / generation |
| HTTP | 200 | 200 |
| Wall time (HTTP) | 39.7 s | 35.8 s |
| Model latency (`ai_call_log.latency_ms`) | 39,260 ms | 35,427 ms |
| Tokens in / out | 3,157 / 5,141 | 3,176 / 5,247 |
| `response_status` | ok | ok |
| Reply | 18,674 chars; ```` ```json ```` fenced, complete, ended cleanly | 19,206 chars; same |
| Parsed + stored | yes; the stored plan equals the route's response | yes; same |
| Merchant rows created from the plan | 8 | 5 |
| Output vs. the 16,000-token budget | 5,141 (no truncation) | 5,247 (no truncation) |

Mechanical structure check (script, against the limits the service's own prompt states): both plans have every section. Counts, A / B: acts 3 / 3 (limit ≤3), world events 5 / 5 (≥5), **NPCs 4 / 5 (prompt says 6–8: below in both)**, companions 3 / 3, locations 5 / 5, factions 3 / 3, side quests 4 / 4, merchants 8 / 5, themes 4 / 5. Zero empty strings in either (352 and 355 text values).

## Plan A — verbatim (the route's JSON response)
```json
{
  "version": 1,
  "generated_at": "2024-05-20T14:30:00Z",
  "last_modified": "2026-11-14T20:31:13.324Z",
  "main_quest": {
    "title": "The Silent Road",
    "summary": "A string of merchant caravans traveling between Waterdeep and Baldur's Gate has vanished without a trace. The disappearance of these shipments has crippled local trade and sparked rumors of an organized bandit presence or something more sinister lurking in the wilderness. The party is hired to investigate the trail, recover lost goods, and find the missing merchants.",
    "hook": "Brannoch's brother, Tavin, was a driver on one of the missing caravans. When Tavin fails to send his monthly letter, Brannoch's concern turns to desperation, prompting him to use his old connections in the City Guard to join an official investigation.",
    "stakes": "If the party fails, the trade route remains severed, leading to a severe economic depression in the Sword Coast and potentially allowing a hostile power to seize control of the supply lines.",
    "acts": [
      {
        "act_number": 1,
        "title": "Vanishing Trails",
        "summary": "The party travels just outside Waterdeep to the first site of a missing caravan, discovering signs of a violent struggle and clues of a specific, organized group.",
        "key_locations": [
          "The High Road",
          "Shadowed Creek"
        ],
        "key_npcs": [
          "Captain Ilsa Dornwright",
          "Tavin (as a target/rumor)"
        ],
        "potential_outcomes": [
          "Discovery of a bandit hideout",
          "Finding a wounded survivor",
          "Tracing the trail to a specific wilderness region"
        ]
      },
      {
        "act_number": 2,
        "title": "The Whispering Woods",
        "summary": "The investigation leads deep into the wilderness where the party must navigate treacherous terrain and face the perpetrators responsible for the disappearances.",
        "key_locations": [
          "The Weeping Woods",
          "Old Waypoint Outpost"
        ],
        "key_npcs": [
          "Kaelen the Sly",
          "Orc War-Chief Grak"
        ],
        "potential_outcomes": [
          "Defeating the bandit leader",
          "Capturing the leader for information",
          "Uncovering a secret smuggling operation"
        ]
      },
      {
        "act_number": 3,
        "title": "The Toll of Trade",
        "summary": "The party reaches the final destination of the missing goods, uncovering the true mastermind behind the sabotage and ensuring the safety of the road.",
        "key_locations": [
          "Baldur's Gate Outskirts",
          "The Broken Carriage"
        ],
        "key_npcs": [
          "Captain Ilsa Dornwright"
        ],
        "potential_outcomes": [
          "Restoring the trade route",
          "Rescuing Tavin",
          "Exposing a high-level conspiracy"
        ]
      }
    ]
  },
  "world_state": {
    "political_situation": "The Lords of Waterdeep are tightening security on the High Road due to rising banditry and suspected Zhentarim smuggling.",
    "major_threats": [
      "Zhentarim expansion",
      "Orcish tribal raids",
      "Cult of the Dragon activity"
    ],
    "faction_tensions": [
      {
        "factions": [
          "The Harpers",
          "The Zhentarim"
        ],
        "nature": "Espionage and control of trade routes.",
        "current_state": "The Zhentarim are aggressively buying up local transport businesses."
      }
    ],
    "regional_news": [
      "A mysterious 'silent' plague affecting livestock",
      "Rise in prices for southern silks",
      "Reports of strange lights in the Weeping Woods"
    ]
  },
  "world_timeline": {
    "description": "Events occurring in the Sword Coast regardless of player actions.",
    "events": [
      {
        "id": "ev_01",
        "title": "Zhentarim Trade Expansion",
        "description": "The Zhentarim successfully seize three major warehouses in a neighboring town.",
        "timing": "2 weeks from campaign start",
        "visibility": "public",
        "affected_locations": [
          "Moonsea Region"
        ],
        "affected_factions": [
          "Zhentarim"
        ],
        "player_can_influence": true,
        "consequences_if_ignored": "The Zhentarim exert more influence over regional laws."
      },
      {
        "id": "ev_02",
        "title": "Orc Migration",
        "description": "Orcish tribes move south in search of fertile land.",
        "timing": "End of Act 1",
        "visibility": "rumored",
        "affected_locations": [
          "The High Road"
        ],
        "affected_factions": [
          "Orcish Tribes"
        ],
        "player_can_influence": false,
        "consequences_if_ignored": "Increased banditry on the trade route."
      },
      {
        "id": "ev_03",
        "title": "Harpers Secret Meeting",
        "description": "The Harpers establish a covert cell in a nearby village.",
        "timing": "3 weeks from campaign start",
        "visibility": "secret",
        "affected_locations": [
          "Nearby Village"
        ],
        "affected_factions": [
          "Harpers"
        ],
        "player_can_influence": false,
        "consequences_if_ignored": "None."
      },
      {
        "id": "ev_04",
        "title": "Waterdeep Tax Hike",
        "description": "Waterdeep imposes a new tariff on goods arriving from the south.",
        "timing": "End of Act 2",
        "visibility": "public",
        "affected_locations": [
          "Waterdeep"
        ],
        "affected_factions": [
          "Lords of Waterdeep"
        ],
        "player_can_influence": false,
        "consequences_if_ignored": "Tensions rise between the merchant guilds."
      },
      {
        "id": "ev_05",
        "title": "Cult of the Dragon Sighting",
        "description": "A cultist cell is spotted near a ruined tower.",
        "timing": "2 weeks from campaign start",
        "visibility": "rumored",
        "affected_locations": [
          "Ruined Tower"
        ],
        "affected_factions": [
          "Cult of the Dragon"
        ],
        "player_can_influence": true,
        "consequences_if_ignored": "The cult establishes a foothold."
      }
    ]
  },
  "npcs": [
    {
      "id": "npc_01",
      "name": "Captain Ilsa Dornwright",
      "role": "mentor",
      "alignment": "lawful_good",
      "from_backstory": true,
      "description": "A scarred, stern woman with graying hair and a sharp gaze.",
      "motivation": "Altruistic; she wants to maintain order and protect the citizens of Waterdeep.",
      "secrets": [
        "She is secretly funding a private investigation into the Zhentarim."
      ],
      "location": "Waterdeep",
      "faction_affiliations": [
        "Waterdeep City Guard"
      ],
      "relationship_to_player": "Former commanding officer and mentor."
    },
    {
      "id": "npc_02",
      "name": "Tavin",
      "role": "ally",
      "alignment": "neutral_good",
      "from_backstory": true,
      "description": "A lanky, cheerful man with a constant soot-stained face.",
      "motivation": "Fearful; he is trying to survive a dangerous situation and reach his brother.",
      "secrets": [
        "He is currently being held for ransom by a bandit leader."
      ],
      "location": "The Weeping Woods",
      "faction_affiliations": [
        "None"
      ],
      "relationship_to_player": "Brannoch's younger brother."
    },
    {
      "id": "npc_03",
      "name": "Kaelen the Sly",
      "role": "rival",
      "alignment": "neutral_evil",
      "from_backstory": false,
      "description": "A smooth-talking man in expensive silks who smells of expensive tobacco.",
      "motivation": "Ambitious; he wants to monopolize the trade route for his own profit.",
      "secrets": [
        "He is bribing the bandits to leave certain routes open for him."
      ],
      "location": "Waterdeep",
      "faction_affiliations": [
        "Zhentarim"
      ],
      "relationship_to_player": "A rival merchant who wants the party out of the way."
    },
    {
      "id": "npc_04",
      "name": "Orc War-Chief Grak",
      "role": "enemy",
      "alignment": "neutral_evil",
      "from_backstory": false,
      "description": "A massive, scarred orc with a jagged blade and a cruel sneer.",
      "motivation": "Pragmatic; he wants to establish a tribe and needs the trade goods to trade with other tribes.",
      "secrets": [
        "He is planning to raid a nearby settlement next."
      ],
      "location": "The Weeping Woods",
      "faction_affiliations": [
        "Orcish Tribes"
      ],
      "relationship_to_player": "Primary antagonist of Act 2."
    }
  ],
  "potential_companions": [
    {
      "id": "comp_01",
      "name": "Elara Shadowstep",
      "race": "Elf",
      "class": "Rogue",
      "alignment": "chaotic_neutral",
      "personality": "Cynical and incredibly sharp-tongued; she trusts no one and is prone to impulsive theft.",
      "motivation": "Greed; she wants a share of the 'lost' cargo's value.",
      "connection_to_main_quest": "A former scout who was hired to track a missing shipment and got caught in the crossfire.",
      "recruitment_location": "Waterdeep",
      "personal_quest_hook": "She is looking for a lost heirloom stolen by the same bandits."
    },
    {
      "id": "comp_02",
      "name": "Brother Valerius",
      "race": "Human",
      "class": "Cleric",
      "alignment": "lawful_neutral",
      "personality": "Dogmatic and uncompromising; he believes any means are justified to uphold his faith's laws.",
      "motivation": "Zealotry; he believes the road is cursed and must be 'purified'.",
      "connection_to_main_quest": "He is a traveling priest investigating 'unnatural' occurrences on the road.",
      "recruitment_location": "Old Waypoint Outpost",
      "personal_quest_hook": "He seeks a relic he believes was taken by the bandits."
    },
    {
      "id": "comp_03",
      "name": "Thokk",
      "race": "Half-Orc",
      "class": "Barbarian",
      "alignment": "neutral_good",
      "personality": "Slow to anger but incredibly loyal; he is prone to reckless bravery when his friends are threatened.",
      "motivation": "Protection; he wants to find his kin who were lost in the woods.",
      "connection_to_main_quest": "A survivor of a previous caravan attack looking for revenge.",
      "recruitment_location": "The Weeping Woods",
      "personal_quest_hook": "He wants to find the specific bandit who led his clan into a trap."
    }
  ],
  "locations": [
    {
      "id": "loc_01",
      "name": "Waterdeep",
      "type": "city",
      "region": "Sword Coast",
      "description": "A massive, bustling metropolis known as the City of Splendors.",
      "importance_to_plot": "The starting point and hub for hiring and gathering information.",
      "notable_features": [
        "Castle Waterdeep",
        "Tradeway Markets",
        "City Guard Barracks"
      ],
      "dangers": [
        "City Watch strictness",
        "Thieves' Guild activity"
      ],
      "opportunities": [
        "Access to high-quality gear",
        "Information from the City Guard"
      ]
    },
    {
      "id": "loc_02",
      "name": "The High Road",
      "type": "wilderness",
      "region": "Sword Coast",
      "description": "The primary artery of trade between major northern cities.",
      "importance_to_plot": "The site of the main quest's mystery.",
      "notable_features": [
        "Caravan inns",
        "Watchtowers"
      ],
      "dangers": [
        "Bandit ambushes",
        "Wild animals"
      ],
      "opportunities": [
        "Finding clues of past attacks"
      ]
    },
    {
      "id": "loc_03",
      "name": "The Weeping Woods",
      "type": "wilderness",
      "region": "Sword Coast",
      "description": "A dense, fog-heavy forest where the light rarely reaches the ground.",
      "importance_to_plot": "The location of the bandit camps and the missing brother.",
      "notable_features": [
        "Ancient ruined structures",
        "Dense fog"
      ],
      "dangers": [
        "Orcish patrols",
        "Predatory beasts"
      ],
      "opportunities": [
        "Hidden loot",
        "Finding the missing caravan"
      ]
    },
    {
      "id": "loc_04",
      "name": "Old Waypoint Outpost",
      "type": "village",
      "region": "Sword Coast",
      "description": "A dilapidated rest stop for weary travelers and merchants.",
      "importance_to_plot": "A place to regroup and gather local rumors.",
      "notable_features": [
        "A single tavern",
        "A well-maintained forge"
      ],
      "dangers": [
        "Desperate bandits",
        "Unstable structures"
      ],
      "opportunities": [
        "Finding a safe place to rest",
        "Local rumors"
      ]
    },
    {
      "id": "loc_05",
      "name": "Baldur's Gate Outskirts",
      "type": "wilderness",
      "region": "Sword Coast",
      "description": "The chaotic, rugged area leading into the fortified city of Baldur's Gate.",
      "importance_to_plot": "The destination where the final confrontation occurs.",
      "notable_features": [
        "Smuggling tunnels",
        "Fortified checkpoints"
      ],
      "dangers": [
        "Mercenary bands",
        "Skirmishers"
      ],
      "opportunities": [
        "Final clues",
        "High-value loot"
      ]
    }
  ],
  "merchants": [
    {
      "id": "merch_01",
      "name": "Barnaby the Bold",
      "type": "blacksmith",
      "location": "Waterdeep",
      "specialty": "Masterwork plate and shields for the City Guard.",
      "personality": "Boisterous and fiercely loyal to the guard; honest but expensive.",
      "prosperity_level": "wealthy"
    },
    {
      "id": "merch_02",
      "name": "Sylas of the Silk",
      "type": "tailor",
      "location": "Waterdeep",
      "specialty": "High-end garments and undercover attire.",
      "personality": "Vain and slightly condescending; he judges your clothes before your words.",
      "prosperity_level": "wealthy"
    },
    {
      "id": "merch_03",
      "name": "Mistress Thorne",
      "type": "alchemist",
      "location": "Waterdeep",
      "specialty": "Potions of healing and vision.",
      "personality": "Nervous and prone to rambling about the dangers of chemistry.",
      "prosperity_level": "comfortable"
    },
    {
      "id": "merch_04",
      "name": "Old Man Grog",
      "type": "general",
      "location": "Old Waypoint Outpost",
      "specialty": "Basic supplies and heavy-duty rope.",
      "personality": "Gruff and tired; he's seen too many caravans disappear and doesn't trust outsiders.",
      "prosperity_level": "poor"
    },
    {
      "id": "merch_05",
      "name": "Finnian the Far-Traveler",
      "type": "general",
      "location": "The High Road",
      "specialty": "Traveler's rations and dried meats.",
      "personality": "Friendly but wary; he's seen a lot of violence on the road lately.",
      "prosperity_level": "modest"
    },
    {
      "id": "merch_06",
      "name": "Mila the Mystic",
      "type": "magic",
      "location": "Waterdeep",
      "specialty": "Wands and scrolls of protection.",
      "personality": "Mysterious and speaks in riddles; she only sells to those she 'approves' of.",
      "prosperity_level": "wealthy"
    },
    {
      "id": "merch_07",
      "name": "Tanner Tom",
      "type": "tanner",
      "location": "Old Waypoint Outpost",
      "specialty": "Leather hides and sturdy boots.",
      "personality": "Smelly and blunt; he doesn't care for small talk.",
      "prosperity_level": "modest"
    },
    {
      "id": "merch_08",
      "name": "Swift-Foot Sam",
      "type": "general",
      "location": "The High Road",
      "specialty": "Quick-buy supplies for merchants.",
      "personality": "Cheerful and quick-witted; always has a joke to lighten the mood.",
      "prosperity_level": "modest"
    }
  ],
  "factions": [
    {
      "id": "fact_01",
      "name": "Waterdeep City Guard",
      "type": "military",
      "alignment_tendency": "lawful_good",
      "description": "The primary peacekeeping force of Waterdeep.",
      "goals": [
        "Maintain order",
        "Protect the trade routes",
        "Apprehend criminals"
      ],
      "resources": [
        "Armed soldiers",
        "Legal authority",
        "Armories"
      ],
      "relationship_to_party": "ally",
      "key_members": [
        "Captain Ilsa Dornwright"
      ]
    },
    {
      "id": "fact_02",
      "name": "The Zhentarim",
      "type": "criminal",
      "alignment_tendency": "neutral_evil",
      "description": "A powerful mercenary and crime syndicate.",
      "goals": [
        "Monopolize trade",
        "Expand influence",
        "Acquire wealth"
      ],
      "resources": [
        "Mercenaries",
        "Spy network",
        "Smuggling routes"
      ],
      "relationship_to_party": "enemy",
      "key_members": [
        "Kaelen the Sly"
      ]
    },
    {
      "id": "fact_03",
      "name": "The Harpers",
      "type": "guild",
      "alignment_tendency": "neutral_good",
      "description": "A secret society dedicated to preserving balance.",
      "goals": [
        "Prevent tyranny",
        "Gather secrets",
        "Protect the innocent"
      ],
      "resources": [
        "Infiltrators",
        "Hidden caches",
        "Information"
      ],
      "relationship_to_party": "potential",
      "key_members": []
    }
  ],
  "side_quests": [
    {
      "id": "sq_01",
      "title": "The Rogue's Debt",
      "type": "personal",
      "description": "Help Elara recover a stolen heirloom from a local thief.",
      "quest_giver": "Elara Shadowstep",
      "location": "Waterdeep",
      "rewards": "Information on the Zhentarim, a set of thieves' tools.",
      "connection_to_main_quest": "Establishes a bond with a potential companion."
    },
    {
      "id": "sq_02",
      "title": "Saviour of the Outpost",
      "type": "combat",
      "description": "Defend the Old Waypoint Outpost from a sudden bandit raid.",
      "quest_giver": "Old Man Grog",
      "location": "Old Waypoint Outpost",
      "rewards": "A discount on supplies and local favor.",
      "connection_to_main_quest": "Protects a key source of information."
    },
    {
      "id": "sq_03",
      "title": "The Weeping Shadows",
      "type": "mystery",
      "description": "Investigate strange, ghostly lights appearing in the Weeping Woods.",
      "quest_giver": "Brother Valerius",
      "location": "The Weeping Woods",
      "rewards": "A blessed holy symbol, a minor miracle.",
      "connection_to_main_quest": "Uncovers supernatural elements of the bandits' operation."
    },
    {
      "id": "sq_04",
      "title": "Supply Run",
      "type": "exploration",
      "description": "Retrieve a lost shipment of medicine for a nearby village.",
      "quest_giver": "Captain Ilsa Dornwright",
      "location": "The High Road",
      "rewards": "A pouch of gold, City Guard commendation.",
      "connection_to_main_quest": "Provides additional rewards and helps maintain the party's reputation."
    }
  ],
  "themes": [
    "Brotherhood",
    "Duty vs. Desire",
    "The Cost of Commerce",
    "Survival"
  ],
  "dm_notes": {
    "session_zero_topics": [
      "Rules for combat",
      "Tone of the 'heroic' fantasy",
      "Player expectations regarding Tavin's safety"
    ],
    "potential_twists": [
      "Tavin is actually working with the bandits to escape his life.",
      "The Zhentarim are paying the bandits to create a shortage to drive up prices."
    ],
    "backup_hooks": [
      "A direct threat from the Zhentarim on the party's lives.",
      "A local village is attacked by a different tribe, forcing a change in direction."
    ],
    "tone_guidance": "Maintain a sense of grounded heroism; focus on the tension of the wilderness and the weight of responsibility."
  }
}
```

## Plan B — verbatim (the route's JSON response)
```json
{
  "version": 1,
  "generated_at": "2024-05-22T10:00:00Z",
  "last_modified": "2026-11-14T20:31:49.321Z",
  "main_quest": {
    "title": "The Salt Crown",
    "summary": "A struggling mining town on the Moonsea coast is being systematically bought by an anonymous, shadowy entity. While the locals suffer from collapsing infrastructure and dwindling resources, a clandestine buyout is occurring, effectively turning the town into a private fiefdom under a veil of secrecy.\n\nThe players must navigate a web of debt-traps, coerced signatures, and sabotage to uncover the mysterious buyer's identity. They will discover that the 'buyer' isn't just looking for minerals, but a strategic foothold for a larger, darker geopolitical maneuver.",
    "hook": "Ysolde's mysterious patron—the one who cleared her salt-smuggling debts—contacts her privately. They want her to investigate the 'hostile acquisition' of a mining town nearby, revealing that her past criminal connections are being used as a tool for this corporate-style espionage.",
    "stakes": "If the players fail, the town will be completely subsumed by a hostile power, its people enslaved or displaced, and Ysolde's patron will likely 'retire' her as a loose end.",
    "acts": [
      {
        "act_number": 1,
        "title": "Dust and Debt",
        "summary": "The party arrives in the failing mining town of Oakhaven, witnessing the desperate struggles of locals. They must identify which local leaders are 'selling out' and who is being coerced.",
        "key_locations": [
          "Oakhaven",
          "The Rusty Pick"
        ],
        "key_npcs": [
          "Osric Fenn",
          "Mayor Vane",
          "The Shadowy Buyer (Proxy)"
        ],
        "potential_outcomes": [
          "Identify a primary mole",
          "Secure the trust of the local miners",
          "Fail to find evidence and face local hostility"
        ]
      },
      {
        "act_number": 2,
        "title": "The Veiled Hand",
        "summary": "As the buyout accelerates, the party discovers the buyer's logistical trail leading toward the Anauroch border. They must infiltrate a high-stakes gala/meeting to find the true identity of the investor.",
        "key_locations": [
          "Mulmaster",
          "Anauroch Outpost"
        ],
        "key_npcs": [
          "Captain Drax",
          "The Shadowy Buyer"
        ],
        "potential_outcomes": [
          "Uncover the buyer's identity",
          "Secure a formal alliance with a rival faction",
          "Be framed for the town's economic collapse"
        ]
      },
      {
        "act_number": 3,
        "title": "Crown of Salt",
        "summary": "The party must decide whether to expose the buyer, seize the assets for themselves, or fulfill their patron's request. A final confrontation occurs as the mining operations are fully weaponized.",
        "key_locations": [
          "Oakhaven Mine",
          "The Moonsea Shore"
        ],
        "key_npcs": [
          "The Shadowy Buyer",
          "Osric Fenn"
        ],
        "potential_outcomes": [
          "The town is liberated but remains poor",
          "The party takes over the mining rights",
          "The buyer's secret organization is exposed to the world"
        ]
      }
    ]
  },
  "world_state": {
    "political_situation": "Growing tension between the Zhentarim expansionists and the local Moonsea lords who fear losing autonomy.",
    "major_threats": [
      "Orcish incursions from Anauroch",
      "Red Wizard trade monopolies",
      "Zhentarim infiltration"
    ],
    "faction_tensions": [
      {
        "factions": [
          "Zhentarim",
          "Harpers"
        ],
        "nature": "Information control vs. shadow influence",
        "current_state": "A cold war of spies and bribe-takers across the Moonsea shore."
      }
    ],
    "regional_news": [
      "A sudden spike in salt prices",
      "Rumors of a 'Ghost Investor' buying up land",
      "Reported sightings of Red Wizard outposts near Anauroch"
    ]
  },
  "world_timeline": {
    "description": "Independent geopolitical shifts in the Moonsea region.",
    "events": [
      {
        "id": "ev_01",
        "title": "The Zhentarim Tax Hike",
        "description": "The Zhentarim announce a new 'protection' tax on all salt transport.",
        "timing": "2 weeks from campaign start",
        "visibility": "public",
        "affected_locations": [
          "Mulmaster",
          "Hillsfar"
        ],
        "affected_factions": [
          "Zhentarim"
        ],
        "player_can_influence": false,
        "consequences_if_ignored": "Local merchants begin fleeing to independent markets."
      },
      {
        "id": "ev_02",
        "title": "Anauroch Tribe Migration",
        "description": "A massive migration of Orcish tribes moves toward the Moonsea shore.",
        "timing": "End of Act 1",
        "visibility": "rumored",
        "affected_locations": [
          "Anauroch",
          "Oakhaven"
        ],
        "affected_factions": [
          "Orcish Tribes"
        ],
        "player_can_influence": true,
        "consequences_if_ignored": "Increased local militia presence and higher prices for supplies."
      },
      {
        "id": "ev_03",
        "title": "Red Wizard Trade Pact",
        "description": "Thay signs a formal trade treaty with a major Moonsea port.",
        "timing": "Middle of Act 2",
        "visibility": "public",
        "affected_locations": [
          "Mulmaster"
        ],
        "affected_factions": [
          "Red Wizards"
        ],
        "player_can_influence": false,
        "consequences_if_ignored": "Local merchants lose their monopoly on eastern trade."
      },
      {
        "id": "ev_04",
        "title": "The Salt Riot",
        "description": "A violent protest breaks out in a mining village over labor conditions.",
        "timing": "End of Act 2",
        "visibility": "public",
        "affected_locations": [
          "Oakhaven"
        ],
        "affected_factions": [
          "Local Militia"
        ],
        "player_can_influence": true,
        "consequences_if_ignored": "The town falls into chaotic anarchy, hindering investigation."
      },
      {
        "id": "ev_05",
        "title": "The Patron's Gambit",
        "description": "Ysolde's patron makes a move to secure the mining rights for a larger syndicate.",
        "timing": "Start of Act 3",
        "visibility": "secret",
        "affected_locations": [
          "Mulmaster",
          "Oakhaven"
        ],
        "affected_factions": [
          "The Shadowy Buyer"
        ],
        "player_can_influence": true,
        "consequences_if_ignored": "The party is betrayed by their patron and hunted as traitors."
      }
    ]
  },
  "npcs": [
    {
      "id": "npc_01",
      "name": "Osric Fenn",
      "role": "neutral",
      "alignment": "neutral_good",
      "from_backstory": true,
      "description": "A weary-looking man with a jagged scar across his nose and a constant look of regret.",
      "motivation": "Seeking redemption and safety from his past crimes.",
      "secrets": [
        "He has a secret contact inside Zhentil Keep."
      ],
      "location": "Zhentil Keep (Prison)",
      "faction_affiliations": [
        "Zhentarim (Former)"
      ],
      "relationship_to_player": "Former partner who took the fall for Ysolde."
    },
    {
      "id": "npc_02",
      "name": "Mayor Vane",
      "role": "enemy",
      "alignment": "neutral_evil",
      "from_backstory": false,
      "description": "A stout man in expensive but slightly frayed silks, always smelling of sour wine.",
      "motivation": "Saving his own skin and wealth at the expense of the town.",
      "secrets": [
        "He is being blackmailed by the Shadowy Buyer's proxy."
      ],
      "location": "Oakhaven",
      "faction_affiliations": [
        "None"
      ],
      "relationship_to_player": "Antagonist who represents the town's decay."
    },
    {
      "id": "npc_03",
      "name": "The Shadowy Buyer",
      "role": "patron",
      "alignment": "lawful_evil",
      "from_backstory": true,
      "description": "A voice transmitted through magical mirrors or letters, never seen.",
      "motivation": "Acquiring a strategic foothold for a clandestine organization.",
      "secrets": [
        "Is actually a high-ranking Red Wizard official."
      ],
      "location": "Unknown",
      "faction_affiliations": [
        "Red Wizards"
      ],
      "relationship_to_player": "The one who cleared Ysolde's debts."
    },
    {
      "id": "npc_04",
      "name": "Captain Drax",
      "role": "ally",
      "alignment": "lawful_neutral",
      "from_backstory": false,
      "description": "A stern, no-nonsense mercenary captain with a practical approach to violence.",
      "motivation": "Maintaining order and ensuring his men get paid.",
      "secrets": [
        "He secretly hates the local government and wants a coup."
      ],
      "location": "Mulmaster",
      "faction_affiliations": [
        "Mercenary Guild"
      ],
      "relationship_to_player": "Provides hired muscle and local intelligence."
    },
    {
      "id": "npc_05",
      "name": "Lirael Moonwhisper",
      "role": "mentor",
      "alignment": "neutral_good",
      "from_backstory": false,
      "description": "An elderly half-elf with sharp eyes and a penchant for herbal teas.",
      "motivation": "Protecting the balance of the Moonsea region.",
      "secrets": [
        "She is a former Harper who went underground."
      ],
      "location": "Mulmaster",
      "faction_affiliations": [
        "Harpers"
      ],
      "relationship_to_player": "Provides occult knowledge and Harper connections."
    }
  ],
  "potential_companions": [
    {
      "id": "comp_01",
      "name": "Kaelen 'The Rat'",
      "race": "Human",
      "class": "Rogue",
      "alignment": "chaotic_neutral",
      "personality": "Greedy and hyper-active, but suffers from severe paranoia about being caught.",
      "motivation": "Pure profit; he wants the biggest cut of any 'hostile acquisition'.",
      "connection_to_main_quest": "Provides street-level connections in Oakhaven and Mulmaster.",
      "recruitment_location": "The Rusty Pick",
      "personal_quest_hook": "Finding his lost sister who was taken by the mining syndicate."
    },
    {
      "id": "comp_02",
      "name": "Sister Valerine",
      "race": "Human",
      "class": "Cleric",
      "alignment": "lawful_neutral",
      "personality": "Zealously devoted to her doctrine, she is often judgmental and lacks empathy for 'sinners'.",
      "motivation": "Purifying the region from the corruption of the Shadowy Buyer.",
      "connection_to_main_quest": "Wants to ensure the town's people are not spiritually corrupted by the buyout.",
      "recruitment_location": "Mulmaster",
      "personal_quest_hook": "Hunting a heretic who stole a sacred relic."
    },
    {
      "id": "comp_03",
      "name": "Thokk the Broken",
      "race": "Half-Orc",
      "class": "Barbarian",
      "alignment": "neutral_good",
      "personality": "Slow to anger but prone to explosive, reckless outbursts; he feels guilty about his past.",
      "motivation": "Looking for a reason to live after being discarded by his tribe.",
      "connection_to_main_quest": "A former miner who was fired and wants to help the workers.",
      "recruitment_location": "Oakhaven",
      "personal_quest_hook": "Seeking a way to heal a permanent injury from a mine collapse."
    }
  ],
  "locations": [
    {
      "id": "loc_01",
      "name": "Oakhaven",
      "type": "town",
      "region": "Moonsea Shore",
      "description": "A dying mining town built into a rocky hillside, smelling of sulfur and damp earth.",
      "importance_to_plot": "The primary setting for the acquisition and the main quest's start.",
      "notable_features": [
        "The Rusty Pick Tavern",
        "The Collapsed Shaft",
        "The Mayor's Manor"
      ],
      "dangers": [
        "Structural instability",
        "Desperate, angry locals",
        "Unstable mine tunnels"
      ],
      "opportunities": [
        "Information from miners",
        "Hidden caches in old shafts"
      ]
    },
    {
      "id": "loc_02",
      "name": "Mulmaster",
      "type": "city",
      "region": "Moonsea Shore",
      "description": "A bustling trade hub known for its heavy commerce and complex political maneuvering.",
      "importance_to_plot": "The logistical center for the buyout and a hub for Harper activity.",
      "notable_features": [
        "The Grand Bazaar",
        "The Harbor",
        "The High District"
      ],
      "dangers": [
        "City watch corruption",
        "Thieves' guilds",
        "Political spies"
      ],
      "opportunities": [
        "High-end magic items",
        "Contacts for the Zhentarim"
      ]
    },
    {
      "id": "loc_03",
      "name": "Anauroch Outpost",
      "type": "wilderness",
      "region": "Anauroch Edge",
      "description": "A fortified, lonely trading post on the edge of the great desert.",
      "importance_to_plot": "A key location for tracking the buyer's supply chain.",
      "notable_features": [
        "The Sandwall",
        "Trade Caravans"
      ],
      "dangers": [
        "Orcish patrols",
        "Extreme heat",
        "Sandstorms"
      ],
      "opportunities": [
        "Tracking evidence",
        "Mercenary contracts"
      ]
    },
    {
      "id": "loc_04",
      "name": "The Rusty Pick",
      "type": "landmark",
      "region": "Oakhaven",
      "description": "A dim, smoky tavern where the miners congregate to complain about their lives.",
      "importance_to_plot": "The primary hub for gathering rumors and meeting local allies.",
      "notable_features": [
        "The 'Mine's End' fireplace",
        "A map of the local tunnels"
      ],
      "dangers": [
        "Brawls",
        "Aggressive locals"
      ],
      "opportunities": [
        "Rumors of the buyer",
        "Local hirelings"
      ]
    },
    {
      "id": "loc_05",
      "name": "Zhentil Keep",
      "type": "dungeon",
      "region": "Zhentil",
      "description": "A formidable fortress and prison managed by the Zhentarim.",
      "importance_to_plot": "The location of Osric Fenn's imprisonment.",
      "notable_features": [
        "The Iron Cage",
        "Zhentarim barracks"
      ],
      "dangers": [
        "Elite guards",
        "Zhentarim spies"
      ],
      "opportunities": [
        "Rescuing Osric",
        "Intelligence on Zhentarim movements"
      ]
    }
  ],
  "merchants": [
    {
      "id": "merch_01",
      "name": "Garrick the Grumpy",
      "type": "blacksmith",
      "location": "Oakhaven",
      "specialty": "Heavy-duty mining tools and rusted blades.",
      "personality": "Gruff and weary, he hates the current economic state and is very stingy.",
      "prosperity_level": "poor"
    },
    {
      "id": "merch_02",
      "name": "Elara Vance",
      "type": "alchemist",
      "location": "Mulmaster",
      "specialty": "Potions for endurance and lung-cleansing.",
      "personality": "Highly professional and somewhat aloof; she values precision over profit.",
      "prosperity_level": "wealthy"
    },
    {
      "id": "merch_03",
      "name": "Milo's General Store",
      "type": "general",
      "location": "Oakhaven",
      "specialty": "Basic rations and mining supplies.",
      "personality": "A desperate man trying to keep his business afloat while the town dies.",
      "prosperity_level": "poor"
    },
    {
      "id": "merch_04",
      "name": "Sariel's Trinkets",
      "type": "magic",
      "location": "Mulmaster",
      "specialty": "Curiosities from the Moonsea region.",
      "personality": "Shrewd and manipulative, she enjoys 'testing' the morality of her customers.",
      "prosperity_level": "comfortable"
    },
    {
      "id": "merch_05",
      "name": "Barek the Wanderer",
      "type": "general",
      "location": "Traveling",
      "specialty": "Exotic spices and desert-adapted gear.",
      "personality": "Cheerful and eternally optimistic, despite the hardships of the road.",
      "prosperity_level": "modest"
    }
  ],
  "factions": [
    {
      "id": "fact_01",
      "name": "The Zhentarim",
      "type": "criminal",
      "alignment_tendency": "neutral_evil",
      "description": "A massive mercenary and criminal organization seeking to dominate the Sword Coast.",
      "goals": [
        "Economic dominance",
        "Control of salt trade",
        "Political influence"
      ],
      "resources": [
        "Mercenary armies",
        "Trade networks",
        "Spy network"
      ],
      "relationship_to_party": "potential",
      "key_members": [
        "Osric Fenn (Former)"
      ]
    },
    {
      "id": "fact_02",
      "name": "The Harpers",
      "type": "guild",
      "alignment_tendency": "neutral_good",
      "description": "A secret society dedicated to maintaining the balance of power and free will.",
      "goals": [
        "Counter-espionage",
        "Stopping tyranny",
        "Preserving independence"
      ],
      "resources": [
        "Hidden safehouses",
        "Information networks",
        "Elite agents"
      ],
      "relationship_to_party": "ally",
      "key_members": [
        "Lirael Moonwhisper"
      ]
    },
    {
      "id": "fact_03",
      "name": "Red Wizards of Thay",
      "type": "arcane",
      "alignment_tendency": "neutral_evil",
      "description": "Powerful mages who seek to expand Thay's influence through magical and economic means.",
      "goals": [
        "Resource acquisition",
        "Arcane research",
        "Expansion of trade enclaves"
      ],
      "resources": [
        "Powerful magic",
        "Trade enclaves",
        "Magical artifacts"
      ],
      "relationship_to_party": "enemy",
      "key_members": [
        "The Shadowy Buyer"
      ]
    }
  ],
  "side_quests": [
    {
      "id": "sq_01",
      "title": "The Broken Vein",
      "type": "exploration",
      "description": "Explore a collapsed mine to recover a lost shipment of precious minerals.",
      "quest_giver": "Garrick the Grumpy",
      "location": "Oakhaven",
      "rewards": "Gold and a high-quality mining pick",
      "connection_to_main_quest": "Provides early clues about the buyer's interests."
    },
    {
      "id": "sq_02",
      "title": "The Spy in the Bazaar",
      "type": "mystery",
      "description": "Identify and intercept a spy who is leaking information about the Harpers.",
      "quest_giver": "Lirael Moonwhisper",
      "location": "Mulmaster",
      "rewards": "Harper favor and a secret contact",
      "connection_to_main_quest": "Establishes a connection with the Harpers."
    },
    {
      "id": "sq_03",
      "title": "Zhentarim Debt",
      "type": "personal",
      "description": "Infiltrate a local Zhentarim outpost to retrieve a ledger of salt debts.",
      "quest_giver": "Ysolde's Patron",
      "location": "Mulmaster",
      "rewards": "A favor from the Patron",
      "connection_to_main_quest": "Deepens the tie to Ysolde's background."
    },
    {
      "id": "sq_04",
      "title": "Orcish Border Skirmish",
      "type": "combat",
      "description": "Defend a small caravan from an Orcish raiding party.",
      "quest_giver": "Captain Drax",
      "location": "Anauroch Outpost",
      "rewards": "Reputation with Drax and a shipment of supplies",
      "connection_to_main_quest": "Context for the regional threats."
    }
  ],
  "themes": [
    "Corporate Espionage",
    "Economic Despair",
    "Moral Ambiguity",
    "The Cost of Debt",
    "Shadowy Influence"
  ],
  "dm_notes": {
    "session_zero_topics": [
      "Defining the 'Shadowy Buyer's' ultimate goal",
      "How much freedom the party has to negotiate with the Zhentarim",
      "Safety tools for dark/political content"
    ],
    "potential_twists": [
      "The Shadowy Buyer is actually trying to save the town from a worse fate",
      "Osric Fenn is actually the one orchestrating the buyout to get his freedom",
      "The 'minerals' being mined are actually a rare component for a forbidden ritual"
    ],
    "backup_hooks": [
      "A direct attack on Oakhaven by a rival mining syndicate",
      "The Harpers requesting a full investigation into the Zhentarim's activities",
      "Ysolde's patron demanding a violent takeover of the town"
    ],
    "tone_guidance": "Keep the atmosphere heavy and paranoid. Use the environment—the dust, the heat, and the decaying buildings—to mirror the decay of the community."
  }
}
```

## Quality assessment
No grading scale; plain judgments with the evidence quoted from the plans above.

### Structure — complete in both
Every section the service promises is present and non-empty. Both replies were complete fenced JSON that needed no repair. IDs are present. Nothing was truncated. The generator's own count limits were missed on NPCs only (4 and 5 against 6–8) and Waterdeep got 4 merchants where the prompt asks for 5–8 for a city; nothing checks or retries on counts.

### Plan A (Sword Coast, levels 1–5) — coherent skeleton, with continuity slips
**Follows the input.** Starts in Waterdeep; the premise is the missing caravans on the Waterdeep–Baldur's Gate road; the hook uses the backstory ("Brannoch's brother, Tavin, was a driver on one of the missing caravans. When Tavin fails to send his monthly letter…"); both backstory figures appear as `from_backstory: true` NPCs (Captain Ilsa Dornwright as mentor, Tavin as a hostage). Tone is heroic. Nothing contradicts the input.
**Slips inside the plan:**
- Act 2 is titled "The Whispering Woods" but every other mention is "The Weeping Woods".
- Act 1 key location "Shadowed Creek" and act 3 key location "The Broken Carriage" are not in the plan's five locations. Act 1 lists the NPC as "Tavin (as a target/rumor)", which matches no NPC name exactly.
- Tavin's location is "The Weeping Woods" (held for ransom), but act 3, whose outcomes include "Rescuing Tavin", is set at "Baldur's Gate Outskirts".
- World event ev_01 "Zhentarim Trade Expansion" lists `affected_locations: ["Moonsea Region"]` in a Sword Coast plan; ev_03 has `consequences_if_ignored: "None."`; ev_04/ev_05 point at unnamed places ("Nearby Village", "Ruined Tower").
**Usable?** A DM could run the first session from it: a clear mystery, an antagonist chain (Kaelen bribes bandits; Grak raids), three companions, four side quests tied to named NPCs. **But it is largely generic.** The names are stock ("Kaelen the Sly", "Elara Shadowstep", "Orc War-Chief Grak", "Brother Valerius"); the threats are the ones the prompt itself lists (Zhentarim, orcs, "Cult of the Dragon Sighting", which the plot never uses); several world events read as filler ("Orc Migration", "Waterdeep Tax Hike", "Harpers Secret Meeting"). **There is nothing level-appropriate:** a level-1 party is pointed at an "Orc War-Chief" as the act-2 antagonist and the plan carries no level or difficulty guidance at all.

### Plan B (Moonsea / Anauroch, levels 5–10) — more specific hook, muddier villain
**Follows the input.** The premise and title follow the seed ("The Salt Crown"; a failing mining town being quietly bought up); the character's salt smuggling, the patron who cleared her debts, and Osric Fenn all appear; Osric is imprisoned in Zhentil Keep and "Rescuing Osric" is listed under that location. Tone is dark and political.
**Slips inside the plan:**
- **The patron and the villain are the same person, but the plan never says so as a twist.** The hook says "Ysolde's mysterious patron… contacts her privately. They want her to investigate the 'hostile acquisition'". The NPC "The Shadowy Buyer" is `role: "patron"`, "The one who cleared Ysolde's debts", secretly "a high-ranking Red Wizard official". Side quest sq_03's giver is "Ysolde's Patron", who has no NPC entry. A DM would have to resolve this before play.
- Osric Fenn is listed as a key NPC in act 1 (set in Oakhaven) and act 3, but his location is "Zhentil Keep (Prison)"; no act or side quest uses the rescue.
- Act 3 locations "Oakhaven Mine" and "The Moonsea Shore" are not in the locations list; "Anauroch Outpost" is typed `wilderness` though described as a fortified trading post; "The Rusty Pick" (a tavern) is typed `landmark`.
- Register drift: "corporate-style espionage", "hostile acquisition", the theme "Corporate Espionage", "gala/meeting" read as modern business language in a medieval setting. The Zhentarim are described as seeking to "dominate the Sword Coast" in a Moonsea plan.
**Usable?** Yes as a skeleton. The three-act buyout intrigue, the Harper contact, the Zhentarim tax, and the dm_notes twists ("The Shadowy Buyer is actually trying to save the town…", "Osric Fenn is actually the one orchestrating the buyout to get his freedom") are genuinely runnable. Same limit as A: **no level guidance** for a level-5 party.

### Is it canned? Partly
The plots are clearly different and each follows its own seed. **But the companion trios are nearly the same in both plans** — A: Elara Shadowstep (Elf Rogue, chaotic neutral), Brother Valerius (Human Cleric, lawful neutral, dogmatic), Thokk (Half-Orc Barbarian, neutral good, "looking for his kin"); B: Kaelen 'The Rat' (Human Rogue, chaotic neutral), Sister Valerine (Human Cleric, lawful neutral, zealous), Thokk the Broken (Half-Orc Barbarian, neutral good). The name "Thokk" and the Rogue/Cleric/Barbarian alignment pattern repeat, and "Kaelen" is an NPC in A and a companion in B. The stock-name habit extends to a blacksmith "Garrick the Grumpy" in B. The model is following the prompt's "span the alignments" instruction with one default template.

### Other things worth knowing
- **`generated_at` is invented by the model** ("2024-05-20T14:30:00Z", "2024-05-22T10:00:00Z"); the parser keeps it. `last_modified` is set by the server.
- **No year appears in either plan.** The prompt hard-codes 1350 DR; `campaignImportService.js:327` also defaults `game_year` to 1350. I could not establish from the code which year Embervale uses.

## Test results
- **Full `npm test` on the PC, after all edits:** Files **245/245 green**, assertions **19,557 passed, 0 failed**.
- This job changed no test and no product code. The previous full run (merge-and-archive report) read 19,554; the +3 is run-to-run variation in the runner's Windows accounting: files it labels `pass*` (a libSQL exit crash after all assertions passed) carry no assertion count, and a different set of files did that this time.
- Windows runner notes from this run: `human-versatile.test.js` and `levelup-subclass-prompts.test.js` were each retried once after a native crash mid-run and passed; `artificer-class`, `companion-sheet` and `rest-time` counted `pass*`.
- The live script is not counted and was not run by `npm test`.

## Files touched
| File | New / edited | SHA-256 | Bytes |
|---|---|---|---|
| `tests/live/campaign-plan-live.mjs` | new | `88820bac58e8bcb56bc74a8ea59246f3f68510f85f539f039e4432b6e58ab4f3` | 12,270 |
| `package.json` | edited (+1 line: `test:campaign-plan`) | `541e9798aba11dca3f2675b7536f21ea9cc0a0f541f5b94b525fc233f2e53019` | 1,398 |
| `docs/pm/campaign-plan-live-check/BRIEF.md` | new (the brief, verbatim) | `cdb0f09953787ab0d40f83feba69f1b46ef630a83065e7da4f9706e7074c082e` | 6,215 |

**No product code changed.** The only non-doc files are the live script and one `package.json` line (`"test:campaign-plan"`), which the brief allows. The script is in `tests/live/` and is not counted or run by `npm test` (the runner reads only `tests/*.test.js`).

## Not done / still open
- No `:5173` click-through (route-level check, as the brief says is enough). Page behavior is read from the code only: `CampaignPlanPage.jsx` animates a fixed progress bar (`GENERATION_STEPS` durations) while the request runs; I did not check how it lines up with the actual 36–40 seconds.
- **Not exercised:** a failed generation (Ollama down, malformed JSON). Read from code: the route returns an error via `handleServerError` and nothing is stored; the parser throws only when the JSON cannot be parsed at all.
- Quality was judged on two samples with invented seeds. That is evidence, not a sample large enough to estimate how often the slips above occur.
- Cost and usage against the $30/month cap: not measurable from inside the session. The generation itself costs nothing (local model).

## Decisions made (reversible, for veto)
1. **Expressed each seed as a campaign description plus a matching character**, because the generator has no free-text seed (see Understanding). Reversal: none needed; rerun with other seeds by editing `SEEDS` in the script.
2. **Seeded the campaign and character rows by SQL** (the campaign through the real create route). The creator flow is not what this checks. Reversal: none.
3. **Added `npm run test:campaign-plan`** and the script, as the brief allows. Reversal: delete the file and the `package.json` line.

## Findings (for the PM; nothing was fixed, per the brief)
1. **Works end to end on the local model.** Two plans in about 36–40 seconds each, about 5,100–5,200 output tokens, no truncation, parsed and stored, merchants created.
2. **Nothing validates the plan.** Both plans missed the prompt's own "6–8 NPCs" and no code notices; `parseAIResponse` would also accept a plan with no `main_quest` and store "Untitled Quest" as a success. A bad plan would not surface as an error.
3. **Cross-references are not enforced.** Both plans refer to places and people they never define (A: Shadowed Creek, The Broken Carriage; B: Oakhaven Mine, "Ysolde's Patron"), and A contradicts itself on where Tavin is.
4. **No level or difficulty content**, because the prompt passes only the character's level and the schema has no field for it. A level-1 party gets an "Orc War-Chief" as an antagonist.
5. **Output leans on a default template** (same companion trio and stock names in both plans) and on the prompt's own list of 1350 DR factions.
6. **The year is hard-coded** to 1350 DR in the prompt and the import default. Whether that matches Embervale is not something the code answers.
7. **Possible follow-ups for the PM** (not done here): a structural validator with one retry for count and cross-reference misses; passing a level range and difficulty into the prompt; trimming the fixed 1350 DR context for the Embervale year; varying the companion archetypes.

## Needs Zach's decision
Nothing blocks. The PM judges from the two plans above whether this is good enough for the MVP or needs a follow-up job. Zach's part is the gate.

## How to verify
Gate: `npm test` on the PC (expect 245 files; this job adds no counted test file). To repeat the live check: start Ollama with gemma4:12b, then `npm run test:campaign-plan` (about 80 seconds; it writes the plans and results to `.test-tmp/`, which the test runner clears). To see it in the game: `npm run dev`, open the Campaign Plan page for a character in a campaign, and press Generate.
