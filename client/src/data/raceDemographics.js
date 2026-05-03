/**
 * Per-race age / height / weight ranges for Step 7's physical-description
 * picker. Distilled from PHB Chapter 2 race entries and Volo's Guide
 * (aasimar) / Eberron: Rising from the Last War (warforged).
 *
 * Per spec §5.7.4 + PM review (2026-05-02): rendered as race-aware
 * dropdowns in Step 7 with a "Custom…" affordance for free-text
 * override (per CLAUDE.md "Decision principles → Player first" — players
 * with specific authored backstory shouldn't be locked out of unusual
 * values).
 *
 * Dual units per PM review (imperial primary, metric in parens):
 *   Height: 5'10" (178 cm)
 *   Weight: 165 lb (75 kg)
 *
 * Age ranges span "young adult — beginning to adventure" to "elder —
 * still capable but late in life." Not every player wants to roleplay
 * the very young or very old; the ranges include the natural spread
 * but a "Custom…" override is always available.
 *
 * Race id keys match `races.json` (hyphenated for half-elf / half-orc).
 */

// Conversion helpers — used at module load to generate dual-unit labels.
const inToCm = inches => Math.round(inches * 2.54)
const lbToKg = lbs => Math.round(lbs * 0.4536 * 10) / 10

/**
 * Format a height in total inches as 5'10" (178 cm).
 */
function fmtHeight(totalInches) {
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${feet}'${inches}" (${inToCm(totalInches)} cm)`
}

/**
 * Format a weight in pounds as 165 lb (75 kg).
 */
function fmtWeight(lbs) {
  return `${lbs} lb (${lbToKg(lbs)} kg)`
}

/**
 * Build an enumerated dropdown list from a numeric range + step.
 * Returns array of { value, label } objects. `value` is the raw number
 * (or feet'inches" string for height); `label` is the dual-unit display.
 */
function ageRange(min, max, step) {
  const out = []
  for (let v = min; v <= max; v += step) out.push({ value: String(v), label: `${v}` })
  return out
}

function heightRange(minInches, maxInches) {
  const out = []
  for (let inches = minInches; inches <= maxInches; inches++) {
    const ft = Math.floor(inches / 12)
    const inch = inches % 12
    out.push({ value: `${ft}'${inch}"`, label: fmtHeight(inches) })
  }
  return out
}

function weightRange(minLbs, maxLbs, step) {
  const out = []
  for (let lbs = minLbs; lbs <= maxLbs; lbs += step) {
    out.push({ value: `${lbs} lb`, label: fmtWeight(lbs) })
  }
  return out
}

export const RACE_DEMOGRAPHICS = {
  // Adulthood ~18, lifespan ~85. Every year through a long adventuring
  // window, then 5-year steps to natural lifespan.
  human: {
    age: [
      ...ageRange(16, 65, 1),
      ...ageRange(70, 85, 5)
    ],
    height: heightRange(53, 79),       // 4'5" – 6'7"
    weight: weightRange(90, 300, 5)
  },

  // Adulthood ~50, lifespan ~350. Lifespan too long for per-year — 5y
  // through prime, 25y for elder.
  dwarf: {
    age: [
      ...ageRange(50, 200, 5),
      ...ageRange(225, 350, 25)
    ],
    height: heightRange(48, 60),       // 4'0" – 5'0"
    weight: weightRange(130, 220, 5)
  },

  // Adulthood ~100, lifespan ~750. 10y through prime, 25y/50y elder.
  elf: {
    age: [
      ...ageRange(100, 300, 10),
      ...ageRange(325, 500, 25),
      ...ageRange(550, 750, 50)
    ],
    height: heightRange(56, 79),       // 4'8" – 6'7"
    weight: weightRange(90, 180, 5)
  },

  // Adulthood ~20, lifespan ~150.
  halfling: {
    age: [
      ...ageRange(20, 60, 1),
      ...ageRange(65, 100, 5),
      ...ageRange(110, 150, 10)
    ],
    height: heightRange(31, 43),       // 2'7" – 3'7"
    weight: weightRange(35, 55, 1)
  },

  // Adulthood ~16, lifespan ~100. Per PHB.
  tiefling: {
    age: [
      ...ageRange(16, 50, 1),
      ...ageRange(55, 100, 5)
    ],
    height: heightRange(55, 79),       // 4'7" – 6'7"
    weight: weightRange(90, 300, 5)
  },

  // Adulthood ~15, lifespan ~80. Per PHB Chapter 2.
  dragonborn: {
    age: [
      ...ageRange(15, 50, 1),
      ...ageRange(55, 80, 5)
    ],
    height: heightRange(68, 88),       // 5'8" – 7'4"
    weight: weightRange(175, 360, 10)
  },

  // Adulthood ~20, lifespan ~180. Bridge of human/elf parents.
  'half-elf': {
    age: [
      ...ageRange(20, 60, 1),
      ...ageRange(65, 120, 5),
      ...ageRange(140, 180, 20)
    ],
    height: heightRange(55, 79),       // 4'7" – 6'7"
    weight: weightRange(90, 280, 5)
  },

  // Adulthood ~14, lifespan ~75.
  'half-orc': {
    age: [
      ...ageRange(14, 50, 1),
      ...ageRange(55, 75, 5)
    ],
    height: heightRange(60, 84),       // 5'0" – 7'0"
    weight: weightRange(140, 380, 10)
  },

  // Adulthood ~16, lifespan ~160. Per Volo's Guide to Monsters.
  aasimar: {
    age: [
      ...ageRange(16, 60, 1),
      ...ageRange(65, 100, 5),
      ...ageRange(120, 160, 20)
    ],
    height: heightRange(55, 79),       // 4'7" – 6'7"
    weight: weightRange(90, 300, 5)
  },

  // Created within the last few decades; age = years since creation.
  // Don't age conventionally. Per Eberron: Rising from the Last War.
  warforged: {
    age: [
      ...ageRange(1, 30, 1),
      ...ageRange(35, 100, 5)
    ],
    height: heightRange(70, 84),       // 5'10" – 7'0"
    weight: weightRange(270, 400, 10)
  }
}

/**
 * Lookup helper. Falls back to human ranges if race is unknown
 * (defensive — caller should always pass a known race, but a safe
 * fallback prevents the picker from going blank on data drift).
 */
export function getRaceDemographics(raceId) {
  return RACE_DEMOGRAPHICS[raceId] || RACE_DEMOGRAPHICS.human
}
