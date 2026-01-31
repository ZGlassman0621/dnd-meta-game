/**
 * Harptos Calendar - The Calendar of the Forgotten Realms
 *
 * The calendar has 12 months of 30 days each, plus 5 special festival days
 * (6 in leap years) that fall between certain months.
 *
 * Total days per year: 365 (366 in leap years, called "Shieldmeet years")
 * Leap years occur every 4 years.
 */

export const MONTHS = [
  { id: 1, name: 'Hammer', nickname: 'Deepwinter', days: 30, season: 'winter' },
  { id: 2, name: 'Alturiak', nickname: 'The Claw of Winter', days: 30, season: 'winter' },
  { id: 3, name: 'Ches', nickname: 'The Claw of Sunsets', days: 30, season: 'spring' },
  { id: 4, name: 'Tarsakh', nickname: 'The Claw of Storms', days: 30, season: 'spring' },
  { id: 5, name: 'Mirtul', nickname: 'The Melting', days: 30, season: 'spring' },
  { id: 6, name: 'Kythorn', nickname: 'The Time of Flowers', days: 30, season: 'summer' },
  { id: 7, name: 'Flamerule', nickname: 'Summertide', days: 30, season: 'summer' },
  { id: 8, name: 'Eleasis', nickname: 'Highsun', days: 30, season: 'summer' },
  { id: 9, name: 'Eleint', nickname: 'The Fading', days: 30, season: 'autumn' },
  { id: 10, name: 'Marpenoth', nickname: 'Leaffall', days: 30, season: 'autumn' },
  { id: 11, name: 'Uktar', nickname: 'The Rotting', days: 30, season: 'autumn' },
  { id: 12, name: 'Nightal', nickname: 'The Drawing Down', days: 30, season: 'winter' }
];

// Festival days that fall between months
export const FESTIVALS = [
  { dayOfYear: 31, name: 'Midwinter', description: 'A day of feasting marking the midpoint of winter. Falls between Hammer and Alturiak.' },
  { dayOfYear: 122, name: 'Greengrass', description: 'The first day of spring, celebrating nature\'s renewal. Falls between Tarsakh and Mirtul.' },
  { dayOfYear: 213, name: 'Midsummer', description: 'The summer solstice, a day of celebration and romance. Falls between Flamerule and Eleasis.' },
  { dayOfYear: 214, name: 'Shieldmeet', description: 'A special festival occurring once every four years, a day of open council. Falls after Midsummer in leap years.', leapYearOnly: true },
  { dayOfYear: 275, name: 'Highharvestide', description: 'A harvest festival celebrating the bounty of the land. Falls between Eleint and Marpenoth.' },
  { dayOfYear: 335, name: 'Feast of the Moon', description: 'A day to honor the dead and ancestors. Falls between Uktar and Nightal.' }
];

// Famous years in the Forgotten Realms timeline
export const NOTABLE_YEARS = {
  1358: 'Year of Shadows (Time of Troubles)',
  1372: 'Year of Wild Magic',
  1385: 'Year of Blue Fire (Spellplague)',
  1479: 'Year of the Ageless One',
  1489: 'Year of the Warrior Princess',
  1491: 'Year of the Scarlet Witch',
  1492: 'Year of Three Ships Sailing (Current default)',
  1493: 'Year of the Purple Dragons',
  1494: 'Year of Twelve Warnings'
};

/**
 * Check if a year is a leap year (Shieldmeet year)
 */
export function isLeapYear(year) {
  return year % 4 === 0;
}

/**
 * Get the total days in a year
 */
export function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Convert a day-of-year (1-365/366) to a readable date
 */
export function dayToDate(dayOfYear, year) {
  if (dayOfYear < 1 || dayOfYear > getDaysInYear(year)) {
    dayOfYear = Math.max(1, Math.min(dayOfYear, getDaysInYear(year)));
  }

  // Check for festival days first
  const festival = FESTIVALS.find(f => {
    if (f.leapYearOnly && !isLeapYear(year)) return false;
    // Adjust for Shieldmeet shifting other dates in leap years
    let festivalDay = f.dayOfYear;
    if (isLeapYear(year) && f.dayOfYear > 213 && f.name !== 'Shieldmeet') {
      festivalDay += 1;
    }
    return festivalDay === dayOfYear;
  });

  if (festival) {
    return {
      dayOfYear,
      year,
      isFestival: true,
      festivalName: festival.name,
      festivalDescription: festival.description,
      displayDate: `${festival.name}, ${year} DR`,
      season: getSeason(dayOfYear)
    };
  }

  // Calculate which month and day within that month
  let remainingDays = dayOfYear;
  let monthIndex = 0;

  // Days before each month, accounting for festivals
  const monthStartDays = [
    1,    // Hammer starts at day 1
    32,   // Alturiak (after Hammer 30 + Midwinter 1)
    62,   // Ches
    92,   // Tarsakh
    123,  // Mirtul (after Greengrass)
    153,  // Kythorn
    183,  // Flamerule
    214,  // Eleasis (after Midsummer, +1 if leap year for Shieldmeet)
    244,  // Eleint
    275,  // Marpenoth (after Highharvestide)
    305,  // Uktar
    336   // Nightal (after Feast of the Moon)
  ];

  // Adjust for leap year
  const adjustedMonthStarts = monthStartDays.map((day, i) => {
    if (isLeapYear(year) && i >= 7) {
      return day + 1;
    }
    return day;
  });

  // Find which month this day falls in
  for (let i = adjustedMonthStarts.length - 1; i >= 0; i--) {
    if (dayOfYear >= adjustedMonthStarts[i]) {
      monthIndex = i;
      remainingDays = dayOfYear - adjustedMonthStarts[i] + 1;
      break;
    }
  }

  const month = MONTHS[monthIndex];
  const dayInMonth = Math.min(remainingDays, 30);

  return {
    dayOfYear,
    year,
    month: month.name,
    monthNickname: month.nickname,
    day: dayInMonth,
    season: month.season,
    isFestival: false,
    displayDate: `${dayInMonth} ${month.name}, ${year} DR`
  };
}

/**
 * Get the current season for a day of year
 */
export function getSeason(dayOfYear) {
  if (dayOfYear <= 60 || dayOfYear > 335) return 'winter';
  if (dayOfYear <= 152) return 'spring';
  if (dayOfYear <= 244) return 'summer';
  return 'autumn';
}

/**
 * Advance time by a number of days
 */
export function advanceTime(currentDay, currentYear, daysToAdvance) {
  let newDay = currentDay + daysToAdvance;
  let newYear = currentYear;

  while (newDay > getDaysInYear(newYear)) {
    newDay -= getDaysInYear(newYear);
    newYear += 1;
  }

  while (newDay < 1) {
    newYear -= 1;
    newDay += getDaysInYear(newYear);
  }

  return { day: newDay, year: newYear };
}

/**
 * Calculate days between two dates
 */
export function daysBetween(day1, year1, day2, year2) {
  if (year1 === year2) {
    return day2 - day1;
  }

  let totalDays = 0;

  if (year2 > year1) {
    // Remaining days in first year
    totalDays += getDaysInYear(year1) - day1;
    // Full years in between
    for (let y = year1 + 1; y < year2; y++) {
      totalDays += getDaysInYear(y);
    }
    // Days into final year
    totalDays += day2;
  } else {
    // Going backwards
    totalDays = -daysBetween(day2, year2, day1, year1);
  }

  return totalDays;
}

/**
 * Get a description of the time of day based on hour (0-23)
 */
export function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 22) return 'dusk';
  return 'night';
}

/**
 * Get season description for atmosphere
 */
export function getSeasonDescription(season) {
  const descriptions = {
    winter: 'The air is crisp and cold, frost coating the ground.',
    spring: 'Fresh blooms and gentle breezes mark the warming days.',
    summer: 'The sun blazes overhead, bringing warmth to the Realms.',
    autumn: 'Leaves turn golden and crimson as the harvest approaches.'
  };
  return descriptions[season] || descriptions.summer;
}

export default {
  MONTHS,
  FESTIVALS,
  NOTABLE_YEARS,
  isLeapYear,
  getDaysInYear,
  dayToDate,
  getSeason,
  advanceTime,
  daysBetween,
  getTimeOfDay,
  getSeasonDescription
};
