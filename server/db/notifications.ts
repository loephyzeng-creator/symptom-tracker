import { and, eq } from "drizzle-orm";
import {
  customTriggers,
  notificationSettings,
  pushSubscriptions,
  users,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { getEntryByUserAndDate } from "./symptomEntries";

// ─── Custom Trigger helpers ────────────────────────────────────────

export async function getTriggersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(customTriggers)
    .where(eq(customTriggers.userId, userId))
    .orderBy(customTriggers.createdAt);
}

export async function addCustomTrigger(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(customTriggers).values({
    userId,
    name,
  });

  return {
    id: Number(result[0].insertId),
    userId,
    name,
  };
}

export async function deleteCustomTrigger(userId: number, triggerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(customTriggers)
    .where(
      and(eq(customTriggers.id, triggerId), eq(customTriggers.userId, userId))
    );
}

// ─── Notification Settings helpers ─────────────────────────────────────

export async function getNotificationSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function upsertNotificationSettings(
  userId: number,
  data: { enabled: number; reminderHour: number; reminderMinute: number; timezone?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getNotificationSettings(userId);
  const setData: Record<string, any> = {
    enabled: data.enabled,
    reminderHour: data.reminderHour,
    reminderMinute: data.reminderMinute,
  };
  if (data.timezone) {
    setData.timezone = data.timezone;
  }

  if (existing) {
    await db
      .update(notificationSettings)
      .set(setData)
      .where(eq(notificationSettings.userId, userId));
    return { ...existing, ...data };
  } else {
    const result = await db.insert(notificationSettings).values({
      userId,
      ...setData,
    });
    return {
      id: Number(result[0].insertId),
      userId,
      ...data,
      lastNotifiedDate: null,
    };
  }
}

export async function getPainkillerDayLimit(userId: number): Promise<number> {
  const settings = await getNotificationSettings(userId);
  return settings?.painkillerDayLimit ?? 10;
}

export async function updatePainkillerDayLimit(
  userId: number,
  limit: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getNotificationSettings(userId);
  if (existing) {
    await db
      .update(notificationSettings)
      .set({ painkillerDayLimit: limit })
      .where(eq(notificationSettings.userId, userId));
  } else {
    await db.insert(notificationSettings).values({
      userId,
      enabled: 1,
      reminderHour: 21,
      reminderMinute: 0,
      painkillerDayLimit: limit,
    });
  }
}

export async function getPainkillerAlertEnabled(userId: number): Promise<boolean> {
  const settings = await getNotificationSettings(userId);
  return (settings?.painkillerAlertEnabled ?? 1) === 1;
}

export async function updatePainkillerAlertEnabled(
  userId: number,
  enabled: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getNotificationSettings(userId);
  if (existing) {
    await db
      .update(notificationSettings)
      .set({ painkillerAlertEnabled: enabled ? 1 : 0 })
      .where(eq(notificationSettings.userId, userId));
  } else {
    await db.insert(notificationSettings).values({
      userId,
      enabled: 1,
      reminderHour: 21,
      reminderMinute: 0,
      painkillerAlertEnabled: enabled ? 1 : 0,
    });
  }
}

export async function updatePainkillerAlertLastDate(
  userId: number,
  date: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(notificationSettings)
    .set({ painkillerAlertLastDate: date })
    .where(eq(notificationSettings.userId, userId));
}

export async function getUsersForPainkillerAlert(todayStr: string) {
  const db = await getDb();
  if (!db) return [];

  const settings = await db
    .select({
      userId: notificationSettings.userId,
      painkillerDayLimit: notificationSettings.painkillerDayLimit,
      painkillerAlertLastDate: notificationSettings.painkillerAlertLastDate,
      weeklyReportFrequency: notificationSettings.weeklyReportFrequency,
      weeklyReportHour: notificationSettings.weeklyReportHour,
      lastWeeklyReportDate: notificationSettings.lastWeeklyReportDate,
      notificationSound: notificationSettings.notificationSound,
    })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.painkillerAlertEnabled, 1)
      )
    );

  return settings.filter((s) => s.painkillerAlertLastDate !== todayStr);
}

export async function getUsersNeedingReminder(todayStr: string) {
  const db = await getDb();
  if (!db) return [];

  const settings = await db
    .select()
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.enabled, 1)
      )
    );

  const results: Array<{
    userId: number;
    reminderHour: number;
    reminderMinute: number;
    hasEntryToday: boolean;
    lastNotifiedDate: string | null;
    userName: string | null;
    notificationSound: string;
  }> = [];

  for (const setting of settings) {
    if (setting.lastNotifiedDate === todayStr) continue;

    const entry = await getEntryByUserAndDate(setting.userId, todayStr);

    const userResult = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, setting.userId))
      .limit(1);

    results.push({
      userId: setting.userId,
      reminderHour: setting.reminderHour,
      reminderMinute: setting.reminderMinute,
      hasEntryToday: !!entry,
      lastNotifiedDate: setting.lastNotifiedDate,
      userName: userResult[0]?.name ?? null,
      notificationSound: setting.notificationSound ?? "default",
    });
  }

  return results;
}

export async function markUserNotified(userId: number, dateStr: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(notificationSettings)
    .set({ lastNotifiedDate: dateStr })
    .where(eq(notificationSettings.userId, userId));
}

export async function getNotificationSoundForUser(userId: number): Promise<string> {
  const settings = await getNotificationSettings(userId);
  return settings?.notificationSound ?? "default";
}

// ─── Push Subscription helpers ───────────────────────────────────────────

export async function savePushSubscription(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, subscription.endpoint)
      )
    );

  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });
}

export async function removePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

export async function getPushSubscriptionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function removePushSubscriptionById(id: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}
