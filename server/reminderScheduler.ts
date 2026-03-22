import {
  getUsersNeedingReminder,
  markUserNotified,
  getPushSubscriptionsByUserId,
  removePushSubscriptionById,
  getMedicationRemindersToSend,
  markMedicationReminderNotified,
  clearMedicationSnooze,
  getMissedMedicationAlerts,
  getMedicationReminders,
  getLowStockAlerts,
  markStockAlertSent,
  getUsersForPainkillerAlert,
  getPainkillerUsageLast30Days,
  updatePainkillerAlertLastDate,
  getWeeklyPainkillerReport,
  getPainkillerDayLimit,
  getNotificationSoundForUser,
} from "./db";
import webpush from "web-push";
import { ENV } from "./_core/env";
import { getDateStrInTimezone, getTimeInTimezone, getDateTimeStrInTimezone, DEFAULT_TIMEZONE } from "../shared/timezone";

/**
 * Check interval in milliseconds (every 15 minutes)
 */
const CHECK_INTERVAL = 15 * 60 * 1000;

/**
 * Configure web-push with VAPID keys
 */
function configureWebPush() {
  if (ENV.vapidPublicKey && ENV.vapidPrivateKey) {
    webpush.setVapidDetails(
      "mailto:symptom-tracker@example.com",
      ENV.vapidPublicKey,
      ENV.vapidPrivateKey
    );
    return true;
  }
  console.warn("[Reminder] VAPID keys not configured, Web Push disabled");
  return false;
}

/**
 * Get current date string in YYYY-MM-DD format using user's timezone.
 * Falls back to DEFAULT_TIMEZONE if no timezone provided.
 */
function getTodayStr(tz?: string): string {
  return getDateStrInTimezone(tz || DEFAULT_TIMEZONE);
}

/**
 * Get current hour, minute, and day of week in user's timezone.
 * Falls back to DEFAULT_TIMEZONE if no timezone provided.
 */
function getChinaTime(tz?: string): { hour: number; minute: number; dayOfWeek: number } {
  return getTimeInTimezone(tz || DEFAULT_TIMEZONE);
}

/**
 * Get current time as ISO-like string for snooze comparison "YYYY-MM-DDTHH:MM".
 * Falls back to DEFAULT_TIMEZONE if no timezone provided.
 */
function getChinaTimeStr(tz?: string): string {
  return getDateTimeStrInTimezone(tz || DEFAULT_TIMEZONE).replace(" ", "T");
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
 * Check if the current day of week is in the repeatDays array.
 * If repeatDays is null/undefined/empty, treat as "every day".
 */
function isDayActive(repeatDays: number[] | null | undefined, currentDayOfWeek: number): boolean {
  if (!repeatDays || repeatDays.length === 0) return true; // null = every day
  return repeatDays.includes(currentDayOfWeek);
}

/**
 * Calculate the effective reminder time after applying offset.
 * Returns { hour, minute } clamped to 0-23:0-59.
 */
function applyOffset(
  hour: number,
  minute: number,
  offsetMinutes: number
): { hour: number; minute: number } {
  let totalMinutes = hour * 60 + minute + offsetMinutes;
  // Clamp to same day (0:00 - 23:59)
  if (totalMinutes < 0) totalMinutes = 0;
  if (totalMinutes > 23 * 60 + 59) totalMinutes = 23 * 60 + 59;
  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  };
}

/**
 * Send Web Push notification to all subscriptions of a user.
 * Returns true if at least one push was sent successfully.
 */
async function sendWebPush(
  userId: number,
  title: string,
  body: string,
  tag?: string,
  actions?: Array<{ action: string; title: string }>,
  extraData?: Record<string, unknown>,
  sound?: string
): Promise<boolean> {
  const subscriptions = await getPushSubscriptionsByUserId(userId);
  if (subscriptions.length === 0) {
    console.log(`[Reminder] No push subscriptions for user ${userId}`);
    return false;
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: tag || "daily-reminder",
    data: {
      url: "/",
      ...extraData,
    },
    actions: actions || [],
    sound: sound || "default",
  });

  let anySuccess = false;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      anySuccess = true;
      console.log(`[Reminder] Push sent to subscription ${sub.id} for user ${userId}`);
    } catch (error: any) {
      // 410 Gone or 404 means subscription is no longer valid
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`[Reminder] Removing expired subscription ${sub.id}`);
        await removePushSubscriptionById(sub.id);
      } else {
        console.error(`[Reminder] Push failed for subscription ${sub.id}:`, error.message);
      }
    }
  }

  return anySuccess;
}

/**
 * Check and send medication reminders.
 * Supports: repeat days (weekday filter), time offset, and snooze.
 */
async function checkAndSendMedicationReminders() {
  try {
    const todayStr = getTodayStr();
    const { hour, minute, dayOfWeek } = getChinaTime();
    const nowStr = getChinaTimeStr();

    const reminders = await getMedicationRemindersToSend(todayStr);
    console.log(`[MedReminder] Found ${reminders.length} pending medication reminder(s) for ${todayStr}`);

    for (const reminder of reminders) {
      // --- Snooze check: if snoozed, check if snooze time has arrived ---
      if (reminder.snoozedUntil) {
        if (nowStr >= reminder.snoozedUntil) {
          // Snooze time reached — send notification
          console.log(
            `[MedReminder] Snooze expired for ${reminder.medicationName}, sending now`
          );
          try {
            const sent = await sendWebPush(
              reminder.userId,
              `💊 用药提醒（稍后提醒）：${reminder.medicationName}`,
              `请服用 ${reminder.medicationName} ${reminder.dosage}`,
              `med-reminder-${reminder.id}`,
              [
                { action: "confirm-taken", title: "✅ 已服药" },
                { action: "snooze", title: "⏰ 再等15分钟" },
              ],
              { reminderId: reminder.id, userId: reminder.userId },
              reminder.notificationSound ?? "default"
            );
            if (sent) {
              await markMedicationReminderNotified(reminder.id, todayStr);
              await clearMedicationSnooze(reminder.id);
              console.log(`[MedReminder] Snoozed reminder sent for ${reminder.medicationName}`);
            }
          } catch (error) {
            console.error(`[MedReminder] Error sending snoozed reminder:`, error);
          }
        }
        // Whether or not snooze time arrived, skip normal flow for snoozed reminders
        continue;
      }

      // --- Day of week check ---
      if (!isDayActive(reminder.repeatDays, dayOfWeek)) {
        console.log(`[MedReminder] Skipping ${reminder.medicationName}: not active on day ${dayOfWeek}`);
        continue;
      }

      // --- Time check with offset (supports multi-time reminders) ---
      const timesToCheck: { hour: number; minute: number; timeIndex?: number }[] = [];
      if (reminder.reminderTimes && Array.isArray(reminder.reminderTimes) && reminder.reminderTimes.length > 0) {
        // Multi-time mode: check each time slot
        for (let ti = 0; ti < reminder.reminderTimes.length; ti++) {
          const t = reminder.reminderTimes[ti] as { hour: number; minute: number };
          timesToCheck.push({ ...applyOffset(t.hour, t.minute, reminder.offsetMinutes ?? 0), timeIndex: ti });
        }
      } else {
        // Single time mode
        timesToCheck.push(applyOffset(reminder.reminderHour, reminder.reminderMinute, reminder.offsetMinutes ?? 0));
      }

      let anyTimeMatched = false;
      for (const effective of timesToCheck) {
        if (!isReminderTime(effective.hour, effective.minute, hour, minute)) {
          continue;
        }
        anyTimeMatched = true;

        const timeLabel = effective.timeIndex !== undefined
          ? `第${effective.timeIndex + 1}次`
          : "";

        console.log(
          `[MedReminder] Sending medication reminder: ${reminder.medicationName} ${reminder.dosage} ${timeLabel} to user ${reminder.userId}`
        );

        try {
          const sent = await sendWebPush(
            reminder.userId,
            `💊 用药提醒：${reminder.medicationName}${timeLabel ? ` (${timeLabel})` : ""}`,
            `请服用 ${reminder.medicationName} ${reminder.dosage}`,
            `med-reminder-${reminder.id}-t${effective.timeIndex ?? 0}`,
            [
              { action: "confirm-taken", title: "✅ 已服药" },
              { action: "snooze", title: "⏰ 再等15分钟" },
            ],
            { reminderId: reminder.id, userId: reminder.userId, timeIndex: effective.timeIndex },
            reminder.notificationSound ?? "default"
          );

          if (sent) {
            console.log(`[MedReminder] Successfully notified for medication ${reminder.medicationName} ${timeLabel} (id: ${reminder.id})`);
          }
        } catch (error) {
          console.error(
            `[MedReminder] Error sending reminder for ${reminder.medicationName} ${timeLabel}:`,
            error
          );
        }
      }

      if (anyTimeMatched) {
        await markMedicationReminderNotified(reminder.id, todayStr);
      } else {
        const timeStrs = timesToCheck.map(t => `${t.hour}:${String(t.minute).padStart(2, "0")}`).join(", ");
        console.log(`[MedReminder] Skipping ${reminder.medicationName}: no time match (times: ${timeStrs}, current ${hour}:${String(minute).padStart(2, "0")})`);
      }
    }
  } catch (error) {
    console.error("[MedReminder] Error in checkAndSendMedicationReminders:", error);
  }
}

/**
 * Run the reminder check: find users who need reminders and send notifications.
 * Also checks medication-specific reminders.
 */
async function checkAndSendReminders() {
  const todayStr = getTodayStr();
  const { hour, minute } = getChinaTime();

  console.log(
    `[Reminder] Checking reminders at ${hour}:${String(minute).padStart(2, "0")} (UTC+8), date: ${todayStr}`
  );

  // 1. Daily symptom recording reminders (isolated try-catch)
  try {
    const usersNeedingReminder = await getUsersNeedingReminder(todayStr);

    for (const user of usersNeedingReminder) {
      if (user.hasEntryToday) continue;
      if (!isReminderTime(user.reminderHour, user.reminderMinute, hour, minute)) {
        continue;
      }

      const userName = user.userName || "用户";
      console.log(`[Reminder] Sending reminder to user ${user.userId} (${userName})`);

      try {
        const sent = await sendWebPush(
          user.userId,
          "📝 症状日记提醒",
          `${userName}，今天还没有记录症状哦！花几分钟记录一下今天的身体状况吧。`,
          undefined,
          undefined,
          undefined,
          user.notificationSound ?? "default"
        );
        if (sent) {
          await markUserNotified(user.userId, todayStr);
          console.log(`[Reminder] Successfully notified user ${user.userId} via Web Push`);
        } else {
          console.warn(`[Reminder] No active push subscriptions for user ${user.userId}`);
        }
      } catch (error) {
        console.error(`[Reminder] Error notifying user ${user.userId}:`, error);
      }
    }
  } catch (error) {
    console.error("[Reminder] Error in daily symptom reminders (non-fatal):", error);
  }

  // 2. Medication-specific reminders (isolated try-catch)
  try {
    await checkAndSendMedicationReminders();
  } catch (error) {
    console.error("[Reminder] Error in medication reminders (non-fatal):", error);
  }

  // 3. Missed medication alerts (check once daily at 10:00 AM)
  try {
    if (hour === 10 && minute < 15) {
      await checkAndSendMissedMedicationAlerts();
    }
  } catch (error) {
    console.error("[Reminder] Error in missed medication alerts (non-fatal):", error);
  }

  // 4. Low stock alerts (check once daily at 9:00 AM)
  try {
    if (hour === 9 && minute < 15) {
      await checkAndSendLowStockAlerts();
    }
  } catch (error) {
    console.error("[Reminder] Error in low stock alerts (non-fatal):", error);
  }

  // 5. Medication expiration alerts (check once daily at 9:30 AM)
  try {
    if (hour === 9 && minute >= 15 && minute < 30) {
      const { checkExpiringMedications } = await import("./db");
      await checkExpiringMedications();
      console.log("[Expiry] Medication expiration check completed");
    }
  } catch (error) {
    console.error("[Reminder] Error in expiration alerts (non-fatal):", error);
  }

  // 6. Painkiller threshold alerts (check once daily at 20:00)
  try {
    if (hour === 20 && minute < 15) {
      await checkAndSendPainkillerThresholdAlerts(todayStr);
    }
  } catch (error) {
    console.error("[Reminder] Error in painkiller threshold alerts (non-fatal):", error);
  }

  // 7. Weekly painkiller usage report (per-user frequency: weekly/biweekly/monthly)
  try {
    await sendWeeklyPainkillerReports(todayStr, hour, minute);
  } catch (error) {
    console.error("[Reminder] Error in weekly painkiller report (non-fatal):", error);
  }
}

/**
 * Check for consecutive missed medications and send push alerts.
 * Runs once daily. Collects unique user IDs from all active reminders,
 * then checks each user for missed medications.
 */
async function checkAndSendMissedMedicationAlerts() {
  try {
    const db = await import("./db");
    const allReminders = await db.getDb().then(async (d) => {
      if (!d) return [];
      const { medicationReminders } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return d.select({ userId: medicationReminders.userId })
        .from(medicationReminders)
        .where(eq(medicationReminders.enabled, 1));
    });

    // Get unique user IDs
    const userIds = Array.from(new Set(allReminders.map((r) => r.userId)));

    for (const userId of userIds) {
      const alerts = await getMissedMedicationAlerts(userId, 3);
      if (alerts.length === 0) continue;

      const medNames = alerts.map((a) => a.medicationName).join("、");
      const maxMissed = Math.max(...alerts.map((a) => a.missedDays));

      const userSound = await getNotificationSoundForUser(userId);
      await sendWebPush(
        userId,
        `⚠️ 漏服警告`,
        `${medNames} 已连续 ${maxMissed} 天未服用，请注意按时服药。`,
        "missed-medication-alert",
        undefined,
        undefined,
        userSound
      );

      console.log(`[MissedMed] Sent missed medication alert to user ${userId}: ${medNames}`);
    }
  } catch (error) {
    console.error("[MissedMed] Error checking missed medications:", error);
  }
}

/**
 * Check for low medication stock and send push alerts.
 * Runs once daily. Checks each user's reminders for low stock.
 */
async function checkAndSendLowStockAlerts() {
  try {
    const dbModule = await import("./db");
    const allReminders = await dbModule.getDb().then(async (d) => {
      if (!d) return [];
      const { medicationReminders } = await import("../drizzle/schema");
      const { eq, and, isNotNull } = await import("drizzle-orm");
      return d.select({ userId: medicationReminders.userId })
        .from(medicationReminders)
        .where(
          and(
            eq(medicationReminders.enabled, 1),
            isNotNull(medicationReminders.stockQuantity)
          )
        );
    });

    const userIds = Array.from(new Set(allReminders.map((r) => r.userId)));

    for (const userId of userIds) {
      const alerts = await getLowStockAlerts(userId);
      if (alerts.length === 0) continue;

      for (const alert of alerts) {
        const body = alert.daysRemaining <= 0
          ? `${alert.medicationName} 已用完，请尽快补药。`
          : `${alert.medicationName} 剩余 ${alert.stockQuantity} 剂，预计 ${alert.daysRemaining} 天后用完，请及时补药。`;

        const stockSound = await getNotificationSoundForUser(userId);
        await sendWebPush(
          userId,
          `💊 药品库存不足`,
          body,
          `low-stock-${alert.reminderId}`,
          undefined,
          undefined,
          stockSound
        );

        await markStockAlertSent(alert.reminderId);
      }

      console.log(`[LowStock] Sent low stock alerts to user ${userId}: ${alerts.map(a => a.medicationName).join(", ")}`);
    }
  } catch (error) {
    console.error("[LowStock] Error checking low stock:", error);
  }
}

/**
 * Check painkiller usage against threshold and send alerts.
 * Runs once daily at 20:00. Sends alerts at 70% (approaching) and 100% (exceeded).
 */
async function checkAndSendPainkillerThresholdAlerts(todayStr: string) {
  try {
    const usersToCheck = await getUsersForPainkillerAlert(todayStr);
    console.log(`[PainkillerAlert] Checking ${usersToCheck.length} user(s) for painkiller threshold`);

    for (const user of usersToCheck) {
      const usageDays = await getPainkillerUsageLast30Days(user.userId, todayStr);
      const limit = user.painkillerDayLimit;
      const warningThreshold = Math.ceil(limit * 0.7); // 70% of limit

      if (usageDays >= limit) {
        // Exceeded threshold
        const sent = await sendWebPush(
          user.userId,
          "\u26a0\ufe0f \u6b62\u75bc\u836f\u4f7f\u7528\u8d85\u9650\u63d0\u9192",
          `\u8fd130\u5929\u5185\u60a8\u5df2\u4f7f\u7528\u6b62\u75bc\u836f ${usageDays} \u5929\uff0c\u5df2\u8fbe\u5230\u8bbe\u5b9a\u4e0a\u9650\uff08${limit} \u5929\uff09\u3002\u8bf7\u6ce8\u610f\u63a7\u5236\u7528\u91cf\uff0c\u5fc5\u8981\u65f6\u54a8\u8be2\u533b\u751f\u3002`,
          "painkiller-threshold-exceeded",
          [{ action: "view-trend", title: "\u67e5\u770b\u8be6\u60c5" }],
          { type: "painkiller-alert", level: "exceeded", url: "/?tab=medication" },
          user.notificationSound ?? "default"
        );
        if (sent) {
          await updatePainkillerAlertLastDate(user.userId, todayStr);
          console.log(`[PainkillerAlert] Exceeded alert sent to user ${user.userId}: ${usageDays}/${limit} days`);
        }
      } else if (usageDays >= warningThreshold) {
        // Approaching threshold
        const remaining = limit - usageDays;
        const sent = await sendWebPush(
          user.userId,
          "\ud83d\udc8a \u6b62\u75bc\u836f\u4f7f\u7528\u63a5\u8fd1\u4e0a\u9650",
          `\u8fd130\u5929\u5185\u60a8\u5df2\u4f7f\u7528\u6b62\u75bc\u836f ${usageDays} \u5929\uff0c\u8ddd\u79bb\u4e0a\u9650\uff08${limit} \u5929\uff09\u8fd8\u5269 ${remaining} \u5929\u3002\u8bf7\u6ce8\u610f\u63a7\u5236\u7528\u91cf\u3002`,
          "painkiller-threshold-warning",
          [{ action: "view-trend", title: "\u67e5\u770b\u8be6\u60c5" }],
          { type: "painkiller-alert", level: "warning", url: "/?tab=medication" },
          user.notificationSound ?? "default"
        );
        if (sent) {
          await updatePainkillerAlertLastDate(user.userId, todayStr);
          console.log(`[PainkillerAlert] Warning alert sent to user ${user.userId}: ${usageDays}/${limit} days`);
        }
      } else {
        console.log(`[PainkillerAlert] User ${user.userId} within safe range: ${usageDays}/${limit} days`);
      }
    }
  } catch (error) {
    console.error("[PainkillerAlert] Error checking painkiller threshold:", error);
  }
}

/**
 * Send weekly painkiller usage reports to users based on their frequency preference.
 * Frequency options: weekly (every Sunday), biweekly (every other Sunday), monthly (1st of month).
 * Each user can set their preferred report hour.
 */
async function sendWeeklyPainkillerReports(todayStr: string, currentHour: number, currentMinute: number) {
  try {
    const usersToCheck = await getUsersForPainkillerAlert(todayStr);
    const { dayOfWeek } = getChinaTime();
    const todayDate = new Date(todayStr + "T00:00:00");
    const todayDay = todayDate.getDate();

    // Filter users who should receive report now based on their frequency and hour settings
    const eligibleUsers = usersToCheck.filter((user) => {
      const reportHour = user.weeklyReportHour ?? 19;
      const frequency = user.weeklyReportFrequency ?? "weekly";

      // Check if current hour matches user's preferred hour (within 15-min window)
      if (currentHour !== reportHour || currentMinute >= 15) return false;

      // Check if already sent today
      if (user.lastWeeklyReportDate === todayStr) return false;

      // Check frequency
      if (frequency === "daily") {
        return true; // Every day at the user's preferred hour
      } else if (frequency === "weekly") {
        return dayOfWeek === 0; // Every Sunday
      } else if (frequency === "biweekly") {
        // Every other Sunday: check if week number is even
        const startOfYear = new Date(todayDate.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((todayDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        return dayOfWeek === 0 && weekNum % 2 === 0;
      } else if (frequency === "monthly") {
        return todayDay === 1; // 1st of each month
      }
      return false;
    });

    console.log(`[WeeklyReport] Sending painkiller reports to ${eligibleUsers.length} eligible user(s) out of ${usersToCheck.length}`);

    for (const user of eligibleUsers) {
      const report = await getWeeklyPainkillerReport(user.userId, todayStr);
      if (!report) continue;

      const limit = await getPainkillerDayLimit(user.userId);
      const trendEmoji = report.trend === "up" ? "\u2b06\ufe0f" : report.trend === "down" ? "\u2b07\ufe0f" : "\u27a1\ufe0f";
      const trendText = report.trend === "up" ? "\u589e\u52a0" : report.trend === "down" ? "\u51cf\u5c11" : "\u6301\u5e73";

      let body = `\u672c\u5468\u6b62\u75bc\u836f\u4f7f\u7528 ${report.thisWeekPainkiller} \u5929`;
      body += `\uff08\u4e0a\u5468 ${report.prevWeekPainkiller} \u5929\uff0c${trendEmoji}${trendText}\uff09`;
      body += `\n\u8fd130\u5929\u7d2f\u8ba1: ${report.last30Painkiller}/${limit} \u5929`;

      if (report.thisWeekPainkiller > 0) {
        body += `\n\u5934\u75db\u5173\u8054: ${report.painkillerWithHeadache}\u5929\u4f34\u5934\u75db\uff0c${report.painkillerWithoutHeadache}\u5929\u65e0\u5934\u75db`;
      }

      if (report.avgHeadachePainkiller > 0 || report.avgHeadacheNoPainkiller > 0) {
        body += `\n\u5e73\u5747\u5934\u75db: \u7528\u836f\u65e5${report.avgHeadachePainkiller}\u5206 vs \u672a\u7528\u836f\u65e5${report.avgHeadacheNoPainkiller}\u5206`;
      }

      const sent = await sendWebPush(
        user.userId,
        "\ud83d\udcca \u6b62\u75bc\u836f\u5468\u62a5",
        body,
        "painkiller-weekly-report",
        [{ action: "view-trend", title: "\u67e5\u770b\u8be6\u60c5" }],
        { type: "painkiller-weekly-report", url: "/?tab=medication" },
        user.notificationSound ?? "default"
      );

      if (sent) {
        // Update lastWeeklyReportDate to prevent duplicate sends
        try {
          const dbModule = await import("./db");
          const dbInst = await dbModule.getDb();
          if (dbInst) {
            const { notificationSettings: ns } = await import("../drizzle/schema");
            const { eq: eqOp } = await import("drizzle-orm");
            await dbInst.update(ns).set({ lastWeeklyReportDate: todayStr }).where(eqOp(ns.userId, user.userId));
          }
        } catch (updateErr: unknown) {
          console.error(`[WeeklyReport] Failed to update lastWeeklyReportDate for user ${user.userId}:`, updateErr);
        }
        console.log(`[WeeklyReport] Report sent to user ${user.userId}: ${report.thisWeekPainkiller} days this week`);
      }
    }
  } catch (error) {
    console.error("[WeeklyReport] Error sending weekly reports:", error);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reminder scheduler. Checks every 15 minutes.
 */
export function startReminderScheduler() {
  const configured = configureWebPush();
  console.log(`[Reminder] Starting reminder scheduler (every 15 min), Web Push: ${configured ? "enabled" : "disabled"}`);

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
export {
  checkAndSendReminders,
  checkAndSendMedicationReminders,
  checkAndSendPainkillerThresholdAlerts,
  isReminderTime,
  isDayActive,
  applyOffset,
  getTodayStr,
  getChinaTime,
  getChinaTimeStr,
  sendWebPush,
  configureWebPush,
  sendWeeklyPainkillerReports,
};
