/**
 * Bargaining Service (M3)
 *
 * Resolves haggle rolls between a party member and a merchant. Pure math —
 * no DB writes here. The calling route handles the roller lookup (character
 * or companion), fetches skill mods, and invokes resolveHaggle() with the
 * computed numbers. The transaction endpoint then applies the returned
 * discount percent to the total cost.
 *
 * Discount tiers by success margin (d20 + mod - DC):
 *   margin  0- 4 →  5%   (minor concession)
 *   margin  5- 9 → 10%
 *   margin 10-14 → 15%
 *   margin 15+   → 20%   (capped; merchants won't cut deeper)
 *
 * DC math:
 *   base by disposition:
 *     hostile 20, unfriendly 18, neutral 15, friendly 12, allied 10
 *   + rarity modifier:
 *     common 0, uncommon +1, rare +3, very_rare +5, legendary +8
 *   + prosperity modifier:
 *     poor -2, modest -1, comfortable 0, aristocratic +2
 *
 * Skill validity:
 *   Persuasion   — classic haggling, friendly negotiation
 *   Deception    — convincing the merchant you're worth a discount you aren't
 *   Intimidation — leaning on them; cumulative disposition hit on failure
 */

const DISPOSITION_DC = {
  hostile: 20, unfriendly: 18, neutral: 15, friendly: 12, allied: 10
};

const RARITY_DC_MOD = {
  common: 0, uncommon: 1, rare: 3, very_rare: 5, legendary: 8
};

const PROSPERITY_DC_MOD = {
  poor: -2, modest: -1, comfortable: 0, aristocratic: 2
};

export const VALID_HAGGLE_SKILLS = new Set(['Persuasion', 'Deception', 'Intimidation']);

/**
 * DC for a haggle attempt. All inputs optional; missing values fall back to
 * "neutral merchant, common item, comfortable shop" = DC 15.
 */
export function calculateHaggleDC({ disposition, prosperity, itemRarity } = {}) {
  const base = DISPOSITION_DC[disposition] ?? DISPOSITION_DC.neutral;
  const rarityMod = RARITY_DC_MOD[itemRarity] ?? 0;
  const prosperityMod = PROSPERITY_DC_MOD[prosperity] ?? 0;
  return base + rarityMod + prosperityMod;
}

/**
 * Resolve a haggle roll.
 *
 * @param {object} args
 * @param {number} args.dc
 * @param {number} args.rollValue        — d20 result (1..20)
 * @param {number} args.abilityModifier  — e.g., CHA mod for Persuasion
 * @param {number} [args.proficiencyBonus=0]
 * @param {boolean}[args.isProficient=true]
 * @param {number} [args.themeBonus=0]   — stackable flat bonus from themes
 * @param {number} [args.attemptNumber=1]— 1 = first, 2+ = repeat this visit
 * @param {string} [args.skill='Persuasion']
 * @returns {object} { success, roll, modifier, total, margin, discountPercent,
 *                     dispositionChange, critical, criticalFail }
 */
export function resolveHaggle(args) {
  const {
    dc, rollValue,
    abilityModifier = 0,
    proficiencyBonus = 0,
    isProficient = true,
    themeBonus = 0,
    attemptNumber = 1,
    skill = 'Persuasion'
  } = args;

  if (!Number.isInteger(rollValue) || rollValue < 1 || rollValue > 20) {
    throw new Error('rollValue must be an integer between 1 and 20');
  }

  const modifier = abilityModifier + (isProficient ? proficiencyBonus : 0) + themeBonus;
  const total = rollValue + modifier;

  const critical = rollValue === 20;
  const criticalFail = rollValue === 1;

  // Nat 20: treat as beating DC by at least 15 (max discount tier)
  // Nat 1:  auto-fail regardless of modifier
  let success = criticalFail ? false : (critical || total >= dc);
  const margin = criticalFail ? -99 : (critical ? 15 : total - dc);

  let discountPercent = 0;
  if (success) {
    if (margin >= 15) discountPercent = 20;
    else if (margin >= 10) discountPercent = 15;
    else if (margin >= 5) discountPercent = 10;
    else discountPercent = 5;
  }

  // Disposition consequence on failure. First attempt = free try. Subsequent
  // attempts during the same visit chip at the merchant's patience. Intimidation
  // is always costly when it fails.
  let dispositionChange = 0;
  if (!success) {
    if (skill === 'Intimidation') {
      dispositionChange = -1 - Math.max(0, attemptNumber - 1);
    } else if (attemptNumber > 1) {
      dispositionChange = -1;
    }
    if (criticalFail) dispositionChange -= 1;
  }

  return {
    success,
    roll: rollValue,
    modifier,
    total,
    dc,
    margin,
    discountPercent,
    dispositionChange,
    critical,
    criticalFail,
    skill
  };
}

/**
 * Theme bonuses for haggle rolls. Read from a progression snapshot's
 * `theme.theme_id`. Flat +2 bonus when the theme fits the skill.
 *
 *   guild_artisan → +2 on Persuasion (they know the craft's true worth)
 *   charlatan     → +2 on Deception  (smooth-talking is their trade)
 *   noble         → +2 on Persuasion (station lends weight)
 *   criminal      → +2 on Intimidation (the threat is believable)
 *   mercenary_veteran → +2 on Intimidation (veterans carry themselves hard)
 */
export function themeHaggleBonus(themeId, skill) {
  if (!themeId) return 0;
  const key = String(themeId).toLowerCase();
  if (skill === 'Persuasion' && (key === 'guild_artisan' || key === 'noble')) return 2;
  if (skill === 'Deception' && key === 'charlatan') return 2;
  if (skill === 'Intimidation' && (key === 'criminal' || key === 'mercenary_veteran')) return 2;
  return 0;
}
