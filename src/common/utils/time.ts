import { DailyMeal } from '@prisma/client';

const IST_OFFSET_MINUTES = 5.5 * 60;

// Cutoffs are IST wall-clock times, in minutes since midnight.
const SERVICE_WINDOW_CUTOFFS_IST: Record<string, number> = {
  BREAKFAST: 7 * 60, // 7:00 AM IST
  LUNCH: 11 * 60, // 11:00 AM IST
  DINNER: 18 * 60, // 6:00 PM IST
};

// Server processes (Docker/Render) run in UTC, not IST, so getHours()/getDate()
// would use the wrong wall clock. Shifting the timestamp by the IST offset and
// reading it back with the UTC getters gives IST wall-clock values regardless
// of the server's actual local timezone.
function nowInIst(): Date {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Checks if a meal's service window is still open for ordering.
 * Restrictions only apply to meals scheduled for "Today" (IST calendar day).
 * Cutoffs are always evaluated in IST, independent of server timezone.
 */
export function isServiceWindowOpen(meal: DailyMeal): boolean {
  const nowIst = nowInIst();
  const mealDate = new Date(meal.date);

  const isToday =
    mealDate.getUTCFullYear() === nowIst.getUTCFullYear() &&
    mealDate.getUTCMonth() === nowIst.getUTCMonth() &&
    mealDate.getUTCDate() === nowIst.getUTCDate();

  if (!isToday) {
    // Future dates are always open; past dates are always closed.
    return mealDate.getTime() > Date.now();
  }

  const currentTimeInMinutes = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  const cutoff = SERVICE_WINDOW_CUTOFFS_IST[meal.service_window?.toUpperCase() ?? ''];

  if (cutoff === undefined) return true; // No restriction for other windows

  return currentTimeInMinutes < cutoff;
}
