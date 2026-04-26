import { DailyMeal } from '@prisma/client';

/**
 * Checks if a meal's service window is still open for ordering.
 * Restrictions only apply to meals scheduled for "Today".
 */
export function isServiceWindowOpen(meal: DailyMeal): boolean {
  const now = new Date();
  const mealDate = new Date(meal.date);

  // If the meal is for a future date, it's always open
  if (mealDate.toDateString() !== now.toDateString()) {
    return mealDate > now; // Must be today or future
  }

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  switch (meal.service_window?.toUpperCase()) {
    case 'BREAKFAST':
      // Cutoff: 6:00 AM (360 minutes)
      return currentTimeInMinutes < 360;
    case 'LUNCH':
      // Cutoff: 11:00 AM (660 minutes)
      return currentTimeInMinutes < 660;
    case 'DINNER':
      // Cutoff: 5:00 PM (1020 minutes)
      return currentTimeInMinutes < 1020;
    default:
      return true; // No restriction for other windows
  }
}
