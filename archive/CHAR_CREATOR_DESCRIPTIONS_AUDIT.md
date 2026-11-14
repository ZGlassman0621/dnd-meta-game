# Character Creator Descriptions Audit

**Date:** 2026-04-19
**Context:** Player feedback — "the character creator we've built is good, but it isn't descriptive enough. I want to make sure that when a player creates a new character, they know who and what they're creating."

**Primary file audited:** `client/src/components/CharacterCreationWizard.jsx`
**Data sources audited:** `client/src/data/` (races, classes, backgrounds, deities, feats, equipment, spells, keeperTexts); `server/data/themes.js`, `server/data/ancestryFeats.js`

---

## Summary

The wizard is strong on **narrative / character-defining choices** (alignment, deity, lifestyle, personality, theme) — these already have descriptions that render in-place when selected. It is weak on **mechanical / item-level choices** (weapons, armor, packs, tools, ability scores, skills, languages, theme sub-choices) — these show bare names with no explainer.

**Biggest wins available** (ranked by player-confusion impact):

| # | Area | Status | Notes |
|---|---|---|---|
| 1 | Equipment items (weapons, armor, gear) | **No descriptions** | Player picks "Longsword" with no damage/AC/cost info |
| 2 | Theme creation-choice options (biome, home city, order type) | **No descriptions** | Options are bare labels; no flavor per choice |
| 3 | Equipment packs (Explorer's, Scholar's, etc.) | **No contents preview** | Player can't compare before picking |
| 4 | Base race descriptions | **Only subrace shown** | Race name alone until subrace picked |
| 5 | Class features | **Name only** | "Action Surge" shown with no mechanical note |
| 6 | Ability scores | **No explainer** | STR/DEX/etc. get "primary ability" marker but no "what it does" |
| 7 | Ancestry feat sub-choice options | **Bare options** | Tool/language/damage-type options have no flavor |
| 8 | Tool proficiencies | **Name only** | Player doesn't know what each tool is for |
| 9 | Skill proficiencies | **Name only** | No explainer of Arcana vs. Nature vs. History |
| 10 | Languages | **Name only** | No context on who speaks it |
| 11 | Magic Initiate class options | **Bare class names** | Wizard/Cleric/Druid/etc. listed without what each grants |
| 12 | Ancestry feat flavor lines | **Data present, unused** | `flavor` field exists; UI hides it |

**Already descriptive, no work needed:** Alignments, Deities, Lifestyles, Cantrips, 1st-level Spells, PHB feat main descriptions, Ancestry feat main descriptions, Themes + L1 ability, Keeper texts + recitations, Personality/ideals/bonds/flaws.

---

## Detailed findings by category

### 1. Stats / Ability scores (STR, DEX, CON, INT, WIS, CHA)

- **Where shown:** Step 2 (Ability Scores), [CharacterCreationWizard.jsx:~1792](client/src/components/CharacterCreationWizard.jsx#L1792)
- **Description rendered:** No — only a ⭐ marker for class primary ability and a ✗ for dump stat
- **Source:** Hardcoded in wizard; no data file
- **Fix:** Add 1-sentence descriptions. Propose:
  - **STR** — Physical power. Melee attack/damage, carrying capacity, climbing, breaking things.
  - **DEX** — Reflexes and agility. Ranged attacks, AC in light armor, Stealth, Acrobatics.
  - **CON** — Toughness. Hit points per level, holding concentration on spells, resisting poison/disease.
  - **INT** — Reasoning and memory. Wizard spellcasting, Arcana, Investigation, History.
  - **WIS** — Perception and insight. Cleric/Druid/Ranger spellcasting, Perception, Insight, Survival.
  - **CHA** — Force of personality. Bard/Sorcerer/Warlock/Paladin spellcasting, Persuasion, Deception, Intimidation.

---

### 2. Races + Subraces

- **Where shown:** Step 1, race + subrace dropdowns, [~line 1176-1225](client/src/components/CharacterCreationWizard.jsx#L1176)
- **Description rendered:** **Subrace: yes** (italic gray below dropdown). **Base race: no**
- **Source:** `client/src/data/races.json` — races have `name/size/speed/languages/traits`; most subraces have a `description` field
- **Fix:** Add a base-race `description` field to each race entry in `races.json`, render it above/beside the subrace description. 2-3 sentences of identity flavor per race.

---

### 3. Classes + Subclasses + Features

- **Where shown:** Step 1, class dropdown + "Class Features" box below, [~line 1585-1743](client/src/components/CharacterCreationWizard.jsx#L1585)
- **Description rendered:** Class description: **yes**. Subclass description: **yes**. Individual feature descriptions: **no**
- **Source:** `client/src/data/classes.json` — `description`, `features[]` (names only), subclass `description`
- **Fix:** `features[]` is currently just bullet-point names. Either:
  - (a) Convert each feature entry to `{ name, description }` objects and render descriptions inline (data + UI change), or
  - (b) Add a separate `feature_descriptions` map per class and show as tooltips/collapsible entries
  - Recommendation: (a) — cleaner data model, easier to maintain

---

### 4. Themes ("Background" picker)

- **Where shown:** Step 1, theme dropdown + description/L1 ability box, [~line 1350-1410](client/src/components/CharacterCreationWizard.jsx#L1350)
- **Description rendered:** **Yes** — theme description and L1 ability description both shown on select
- **Source:** server `themes.js` (via progression API)
- **Status:** ✅ No action needed

---

### 5. Theme creation-choice options (Outlander biome, City Watch home city, Knight order type)

- **Where shown:** Step 1, sub-dropdown that appears inside a selected theme's box, [~line 1403-1422](client/src/components/CharacterCreationWizard.jsx#L1403)
- **Description rendered:** No
- **Source:** `server/data/themes.js` — `creation_choice_options[]` is a bare string array
- **Fix:** Upgrade the schema from `string[]` to `{ value, label, description }[]`. Update seed service + UI.
  - **Outlander biomes (9):** forest, desert, mountain, arctic, swamp, coastal, grasslands, underground, extra_planar — each needs 1 sentence of what life there was like + what the character learned to handle
  - **City Watch home cities (10):** Waterdeep, Baldur's Gate, Neverwinter, Luskan, Silverymoon, Mithral Hall, Candlekeep, Menzoberranzan, Calimport, Athkatla — each needs 1 sentence on the city's character + what the watch is like there
  - **Knight order types (4):** chivalric, religious, scholarly, secret — each needs 1 sentence on what kind of order it is

---

### 6. Ancestry feats (Tier-1)

- **Where shown:** Step 1, feat card picker, [~line 1228-1349](client/src/components/CharacterCreationWizard.jsx#L1228)
- **Description rendered:** **Yes** — full second-person description per feat (rewritten in v1.0.26)
- **Source:** `server/data/ancestryFeats.js`
- **Status:** ✅ Main descriptions complete. Optional polish: `flavor` field exists in data (e.g., "A dwarf is built to endure.") but UI doesn't render it. Low priority nice-to-have.

---

### 7. Ancestry feat sub-choices (skill/language/damage-type options inside a feat)

- **Where shown:** Step 1, inside selected feat card, [~line 1284-1341](client/src/components/CharacterCreationWizard.jsx#L1284)
- **Description rendered:** No
- **Source:** `client/src/data/equipment.json` (languages, tools); hardcoded constants in wizard (skills, damage types)
- **Fix:** Inline descriptions when hovering or under a selected option. Options that need descriptions:
  - **Skills (18):** standard D&D 5e — Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival
  - **Tools (~17 artisan + 3 kits + gaming + musical):** common artisan list — 1 sentence on what each is used for
  - **Languages (~16 standard + exotic):** who speaks them, regional/planar context
  - **Damage types (~13):** brief flavor on the elemental nature
  - **Weapons (~23 martial):** damage, properties (data exists in equipment.json; just needs surfacing)

---

### 8. Skill proficiencies (class skill choices)

- **Where shown:** Step 2 (skill picker for class), partially referenced in Step 1 class features box
- **Description rendered:** No
- **Fix:** Same descriptions as #7 skills — produce one authoritative `SKILLS_REFERENCE` mapping and surface it wherever skills are pickable.

---

### 9. Tool proficiencies

- **Where shown:** Step 1, Background Feature section, [~line 1500-1580](client/src/components/CharacterCreationWizard.jsx#L1500)
- **Description rendered:** No
- **Fix:** Same as #7 tools — surface descriptions wherever a tool appears in a picker.

---

### 10. Languages

- **Where shown:** Step 1, background language picker, [~line 1443-1481](client/src/components/CharacterCreationWizard.jsx#L1443)
- **Description rendered:** No (just standard vs. exotic optgroup labels)
- **Source:** `client/src/data/equipment.json` — flat arrays of language names
- **Fix:** Create a `LANGUAGE_DESCRIPTIONS` map with 1-sentence descriptions of each language's cultural/regional context. Surface on hover or via helper text.

---

### 11. Alignments

- **Where shown:** Step 3 alignment dropdown, [~line 2708-2730](client/src/components/CharacterCreationWizard.jsx#L2708)
- **Description rendered:** **Yes** — full paragraph shown on select (added v1.0.29)
- **Status:** ✅ No action needed

---

### 12. Deities / Faith

- **Where shown:** Step 3 faith dropdown, [~line 2732-2789](client/src/components/CharacterCreationWizard.jsx#L2732)
- **Description rendered:** **Yes** — description + alignment + domain shown on select
- **Status:** ✅ No action needed

---

### 13. Lifestyle

- **Where shown:** Step 3 lifestyle dropdown, [~line 2791-2816](client/src/components/CharacterCreationWizard.jsx#L2791)
- **Description rendered:** **Yes** — full paragraph shown on select (added v1.0.29)
- **Status:** ✅ No action needed

---

### 14. Cantrips

- **Where shown:** Step 2 cantrip grid, [~line 2556+](client/src/components/CharacterCreationWizard.jsx#L2556)
- **Description rendered:** **Yes** — inline below name (fixed in v1.0.29)
- **Status:** ✅ No action needed

---

### 15. 1st-level spells

- **Where shown:** Step 2 spell grid, [~line 2627+](client/src/components/CharacterCreationWizard.jsx#L2627)
- **Description rendered:** **Yes** — inline below name (fixed in v1.0.29)
- **Status:** ✅ No action needed

---

### 16. PHB feats (Variant Human bonus)

- **Where shown:** Step 2, Variant Human feat picker
- **Description rendered:** Main feat description: **yes**. Sub-choice grids for cantrip/spell (Magic Initiate, Ritual Caster): **yes** (spell descriptions render in the grid). Sub-choice for class picker: **no** (class option is just a bare name)
- **Fix:** Add a class-options-for-spellcasting map with 1 sentence per class on their spell flavor (e.g., Wizard = arcane study, Cleric = divine favor).

---

### 17. Starting equipment packs

- **Where shown:** Step 4 equipment section, [~line 3175+](client/src/components/CharacterCreationWizard.jsx#L3175)
- **Description rendered:** Name only in picker; contents not surfaced until after selection
- **Source:** `client/src/data/equipment.json` — `packs{}` with `contents[]` + `cost`
- **Fix:** Show pack contents as a preview under each option (tooltip or expandable list) so player can compare before picking.

---

### 18. Individual equipment items (weapons, armor, gear)

- **Where shown:** Step 4 equipment pickers, [~line 3268-3311](client/src/components/CharacterCreationWizard.jsx#L3268)
- **Description rendered:** **NO** — just names in dropdowns
- **Source:** `client/src/data/equipment.json` — all the data is there (damage, damageType, properties, cost, weight, AC for armor), just not surfaced
- **Fix:** **Highest priority.** Render stats inline: "Longsword (1d8 slashing, 15gp, versatile)". Tooltip or inline line below name.

---

### 19. Keeper class texts + recitations

- **Where shown:** Step 1 or 2 (if class = keeper), [~line 2447-2510](client/src/components/CharacterCreationWizard.jsx#L2447)
- **Description rendered:** **Yes**
- **Status:** ✅ No action needed

---

### 20. Personality traits / ideals / bonds / flaws

- **Where shown:** Step 3 personality section, [~line 2884-3106](client/src/components/CharacterCreationWizard.jsx#L2884)
- **Description rendered:** **Yes** — background suggestions have full text; ideals include name + description + alignment
- **Status:** ✅ No action needed

---

### 21. Physical appearance fields

- **Where shown:** Step 3 physical appearance, [~line 2818-2882](client/src/components/CharacterCreationWizard.jsx#L2818)
- **Description rendered:** Placeholder examples in inputs (sufficient)
- **Status:** ✅ No action needed

---

## Priority-ranked work plan

**P1 — Highest player-confusion impact (do first):**

1. **Equipment items** (weapons, armor, gear) — surface damage/AC/cost/properties inline in all pickers. Data already in `equipment.json`; purely a UI rendering change.
2. **Theme creation-choice options** — upgrade `creation_choice_options` schema from `string[]` to `{ value, label, description }[]`. Write 23 option descriptions (9 biomes + 10 cities + 4 order types). Update seed service UPSERT + UI rendering.
3. **Equipment pack contents preview** — surface `packs[].contents` as a readable list in the pack picker.

**P2 — Significant but smaller individual impact:**

4. **Base race descriptions** — add a `description` field to each race in `races.json`; render above subrace description. 10 entries.
5. **Class feature descriptions** — upgrade `classes.json features[]` from `string[]` to `{ name, description }[]`. ~12 classes × ~5-8 features each = ~60-90 feature descriptions.
6. **Ability score explainers** — 6 one-sentence descriptions, hardcoded in wizard.

**P3 — Nice-to-have, fills gaps:**

7. **Skill reference map** (18 skills × 1 sentence) — surface wherever skills are picked.
8. **Tool reference map** (~20 tools × 1 sentence) — surface wherever tools are picked.
9. **Language reference map** (~16 languages × 1 sentence) — surface wherever languages are picked.
10. **Damage type reference map** (13 types × 1 short flavor phrase) — surface in ancestry feat damage-type pickers.
11. **Magic Initiate class option flavors** — 6 class × 1 sentence on what kind of spellcaster they are.

**P4 — Polish:**

12. **Ancestry feat `flavor` line rendering** — data exists, just surface it below the description.

---

## Implementation notes

- **Data-first approach:** Most descriptions belong in data files (json/js), not hardcoded in the wizard. That keeps rendering clean and makes future edits localized.
- **Reference maps for shared terms:** Skills, tools, languages, damage types appear in multiple pickers. Create ONE authoritative map per category and reuse it.
- **Seed service UPSERT** (extended in v1.0.39) already handles propagating theme `creation_choice_options` changes on next boot — no DB reset needed.
- **Don't break existing tests.** Character-memory (56), moral-diversity (59), nickname-resolver (49), combat-tracker (26), condition-tracking (56), rolling-summary (21) — all currently green.

---

## Estimated scope

- **P1** — 3-5 hours. Biggest wins.
- **P2** — 4-6 hours. Includes 60-90 class feature descriptions (can pull from 5e SRD wording).
- **P3** — 2-3 hours. Reference maps are mechanical.
- **P4** — 15 min. Single UI surface.

**Total: ~10-15 hours.** Shippable as multiple incremental releases (one per priority tier, or one per category).

---

## Open questions

1. **Source of truth for SRD-style content** — for class feature descriptions, should I write originals or pull from the 5e SRD (which is freely licensed)? Originals are safer but slower.
2. **Rendering style preference** — tooltips on hover, inline expandable `<details>`, or always-visible helper text? I'd lean always-visible for stats/items (compactly formatted) and `<details>` for long prose (feature descriptions).
3. **Batching** — ship one release with everything, or one release per priority tier? I'd lean per-priority for easier testability + cleaner rollback if something breaks.
