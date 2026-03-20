import { getUsersNeedingReminder, markUserNotified } from "./db";
import { notifyOwner } from "./_core/notification";

/**
 * Check interval in milliseconds (every 15 minutes)
 */
const CHECK_INTERVAL = 15 * 60 * 1000;

/**
 * Get current date string in YYYY-MM-DD format (UTC+8 for China timezone)
 */
function getTodayStr(): string {
  const now = new Date();
  // UTC+8
  const offset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(now.getTime() + offset);
  return chinaTime.toISOString().slice(0, 10);
}

/**
 * Get current hour and minute in China timezone (UTC+8)
 */
function getChinaTime(): { hour: number; minute: number } {
  const now = new Date();
  const offset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(now.getTime() + offset);
  return {
    hour: chinaTime.getUTCHours(),
    minute: chinaTime.getUTCMinutes(),
  };
}

/**
 * Check if it's time to send a reminder for a user.
 * We allow a 15-minute window after the scheduled time.
 */
function isReminderTime(
  scheduledHour: number,
  scheduledMinute: number,
  currentHour: number,
  currentMinute: number
): boolean {
  const scheduledTotal = scheduledHour * 60 + scheduledMinute;
  const currentTotal = currentHour * 60 + currentMinute;
  // Within 15 minutes after scheduled time
  return currentTotal >= scheduledTotal && currentTotal < scheduledTotal + 15;
}

/**
 * Run the reminder check: find users who need reminders and send notifications.
 */
async function checkAndSendReminders() {
  try {
    const todayStr = getTodayStr();
    const { hour, minute } = getChinaTime();

    console.log(
      `[Reminder] Checking reminders at ${hour}:${String(minute).padStart(2, "0")} (UTC+8), date: ${todayStr}`
    );

    const usersNeedingReminder = await getUsersNeedingReminder(todayStr);

    for (const user of usersNeedingReminder) {
      // Skip if user already recorded today
      if (user.hasEntryToday) continue;

      // Check if it's the right time for this user
      if (!isReminderTime(user.reminderHour, user.reminderMinute, hour, minute)) {
        continue;
      }

      const userName = user.userName || "用户";

      console.log(
        `[Reminder] Sending reminder to user ${user.userId} (${userName})`
      );

      try {
        const sent = await notifyOwner({
          title: "📝 症状日记提醒",
          content: `${userName}，今天还没有记录症状哦！花几分钟记录一下今天的身体状况吧。坚持记录有助于发现症状规律，为就诊提供参考。`,
        });

        if (sent) {
          await markUserNotified(user.userId, todayStr);
          console.log(`[Reminder] Successfully notified user ${user.userId}`);
        } else {
          console.warn(
            `[Reminder] Failed to notify user ${user.userId}`
          );
        }
      } catch (error) {
        console.error(
          `[Reminder] Error notifying user ${user.userId}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("[Reminder] Error in checkAndSendReminders:", error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reminder scheduler. Checks every 15 minutes.
 */
export function startReminderScheduler() {
  console.log("[Reminder] Starting reminder scheduler (every 15 min)");

  // Run first check after a short delay to let the server fully start
  setTimeout(() => {
    checkAndSendReminders();
  }, 10_000);

  // Then check every 15 minutes
  intervalId = setInterval(checkAndSendReminders, CHECK_INTERVAL);
}

/**
 * Stop the reminder scheduler.
 */
export function stopReminderScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Reminder] Scheduler stopped");
  }
}

// Export for testing
export { checkAndSendReminders, isReminderTime, getTodayStr, getChinaTime };
