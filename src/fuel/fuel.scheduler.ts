import { fuelService } from './fuel.service';

const IST_OFFSET_MINUTES = 5.5 * 60;
const NIGHTLY_HOUR = 23;
const NIGHTLY_MINUTE = 59;

function nowInIstParts() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return {
    now,
    ist,
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    date: ist.getUTCDate(),
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  };
}

function nextIstWallClockDelay(hour: number, minute: number) {
  const parts = nowInIstParts();
  const targetIst = new Date(Date.UTC(parts.year, parts.month, parts.date, hour, minute, 0, 0));

  if (
    parts.hour > hour ||
    (parts.hour === hour && parts.minute >= minute)
  ) {
    targetIst.setUTCDate(targetIst.getUTCDate() + 1);
  }

  const targetUtcMs = targetIst.getTime() - IST_OFFSET_MINUTES * 60 * 1000;
  return Math.max(targetUtcMs - parts.now.getTime(), 1000);
}

function scheduleNightlyFuelFulfillment() {
  const delay = nextIstWallClockDelay(NIGHTLY_HOUR, NIGHTLY_MINUTE);

  setTimeout(async () => {
    try {
      console.log('[Fuel Scheduler] Generating next 48 hours of Fuel fulfillments');
      await fuelService.generateFulfillments(2);
    } catch (error) {
      console.error('[Fuel Scheduler] Fulfillment generation failed:', error);
    } finally {
      scheduleNightlyFuelFulfillment();
    }
  }, delay);
}

function scheduleFuelPrepReminderSweep() {
  const intervalMs = 10 * 60 * 1000;

  setInterval(async () => {
    try {
      await fuelService.sendPrepReminders(3);
    } catch (error) {
      console.error('[Fuel Scheduler] Prep reminder sweep failed:', error);
    }
  }, intervalMs);
}

export function setupFuelScheduler() {
  if (process.env.FUEL_SCHEDULER_ENABLED === 'false') {
    console.log('[Fuel Scheduler] Disabled by FUEL_SCHEDULER_ENABLED=false');
    return;
  }

  scheduleNightlyFuelFulfillment();
  scheduleFuelPrepReminderSweep();
  console.log('[Fuel Scheduler] Enabled: nightly 23:59 IST generation + 3-hour prep reminders');
}
