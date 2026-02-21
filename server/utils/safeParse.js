/**
 * Safe JSON parsing utility.
 * Wraps JSON.parse with try/catch to prevent crashes from corrupted DB data.
 *
 * @param {string} jsonString - The JSON string to parse
 * @param {*} fallback - Value to return on parse failure (default: null)
 * @returns {*} Parsed value or fallback
 */
export function safeParse(jsonString, fallback = null) {
  if (jsonString === null || jsonString === undefined) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    console.warn('[safeParse] Failed to parse JSON, using fallback:', typeof jsonString === 'string' ? jsonString.slice(0, 100) : typeof jsonString);
    return fallback;
  }
}
