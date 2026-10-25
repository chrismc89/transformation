/**
 * Resolve the signal cascade reference date.
 * Live API data uses wall-clock time; demo fixtures stay pinned to the fixture week.
 * @param {boolean} isLiveMode
 * @param {string} [weekOf] ISO date (YYYY-MM-DD) used only in demo mode
 * @param {Date} [now]
 * @returns {Date}
 */
export function resolveAsOfDate(isLiveMode, weekOf, now = new Date()) {
  if (isLiveMode) return now;
  if (!weekOf) return now;
  return new Date(weekOf + 'T12:00:00Z');
}
