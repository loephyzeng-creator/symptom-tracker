import { and, eq, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  symptomEntries,
  InsertSymptomEntry,
  customTriggers,
  InsertCustomTrigger,
  notificationSettings,
  pushSubscriptions,
  customMetrics,
  customMetricValues,
  medicationReminders,
  medicationGroups,
  drugInteractions,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { buildEntryMedMap, wasMedTaken } from "./medMatchHelper";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Symptom Entry helpers ───────────────────────────────────────────

export async function getEntriesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(desc(symptomEntries.date));
}

export async function getEntriesByDateRange(userId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startDate),
        lte(symptomEntries.date, endDate)
      )
    )
    .orderBy(symptomEntries.date);
}

/**
 * Count days with painkiller usage in the last 30 days from a given date.
 */
export async function getPainkillerUsageLast30Days(userId: number, fromDate: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const d = new Date(fromDate + "T00:00:00");
  d.setDate(d.getDate() - 29); // 30 days including fromDate
  const startDate = d.toISOString().slice(0, 10);

  const rows = await db
    .select({ painkillerTaken: symptomEntries.painkillerTaken })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startDate),
        lte(symptomEntries.date, fromDate),
        eq(symptomEntries.painkillerTaken, 1)
      )
    );

  return rows.length;
}

/**
 * Get weekly painkiller usage report data for a user.
 * Returns last 7 days painkiller count, last 30 days count, headache correlation, and trend.
 */
export async function getWeeklyPainkillerReport(userId: number, todayStr: string) {
  const db = await getDb();
  if (!db) return null;

  // Last 7 days
  const d7 = new Date(todayStr + "T00:00:00");
  d7.setDate(d7.getDate() - 6);
  const start7 = d7.toISOString().slice(0, 10);

  // Last 30 days
  const d30 = new Date(todayStr + "T00:00:00");
  d30.setDate(d30.getDate() - 29);
  const start30 = d30.toISOString().slice(0, 10);

  // Previous 7 days (for trend comparison)
  const d14 = new Date(todayStr + "T00:00:00");
  d14.setDate(d14.getDate() - 13);
  const start14 = d14.toISOString().slice(0, 10);

  const entries30 = await db
    .select({
      date: symptomEntries.date,
      painkillerTaken: symptomEntries.painkillerTaken,
      headache: symptomEntries.headache,
      severeHeadache: symptomEntries.severeHeadache,
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, start30),
        lte(symptomEntries.date, todayStr)
      )
    );

  const last7Entries = entries30.filter((e) => e.date >= start7);
  const prev7Entries = entries30.filter((e) => e.date >= start14 && e.date < start7);

  const thisWeekPainkiller = last7Entries.filter((e) => e.painkillerTaken === 1).length;
  const prevWeekPainkiller = prev7Entries.filter((e) => e.painkillerTaken === 1).length;
  const last30Painkiller = entries30.filter((e) => e.painkillerTaken === 1).length;

  // Headache correlation: days with both painkiller and headache >= 5
  const painkillerWithHeadache = last7Entries.filter(
    (e) => e.painkillerTaken === 1 && (e.headache >= 5 || (e.severeHeadache ?? 0) >= 2)
  ).length;
  const painkillerWithoutHeadache = thisWeekPainkiller - painkillerWithHeadache;

  // Average headache on painkiller days vs non-painkiller days (last 30 days)
  const painkillerDays30 = entries30.filter((e) => e.painkillerTaken === 1);
  const nonPainkillerDays30 = entries30.filter((e) => e.painkillerTaken !== 1);
  const avgHeadachePainkiller = painkillerDays30.length > 0
    ? painkillerDays30.reduce((sum, e) => sum + e.headache, 0) / painkillerDays30.length
    : 0;
  const avgHeadacheNoPainkiller = nonPainkillerDays30.length > 0
    ? nonPainkillerDays30.reduce((sum, e) => sum + e.headache, 0) / nonPainkillerDays30.length
    : 0;

  // Trend: up, down, or stable
  let trend: "up" | "down" | "stable" = "stable";
  if (thisWeekPainkiller > prevWeekPainkiller) trend = "up";
  else if (thisWeekPainkiller < prevWeekPainkiller) trend = "down";

  return {
    thisWeekPainkiller,
    prevWeekPainkiller,
    last30Painkiller,
    trend,
    painkillerWithHeadache,
    painkillerWithoutHeadache,
    avgHeadachePainkiller: Math.round(avgHeadachePainkiller * 10) / 10,
    avgHeadacheNoPainkiller: Math.round(avgHeadacheNoPainkiller * 10) / 10,
    start7,
    todayStr,
  };
}

/**
 * Toggle painkillerTaken for a specific date. Creates entry if it doesn't exist.
 */
export async function togglePainkillerForDate(userId: number, date: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const existing = await db
    .select({ id: symptomEntries.id, painkillerTaken: symptomEntries.painkillerTaken })
    .from(symptomEntries)
    .where(
      and(eq(symptomEntries.userId, userId), eq(symptomEntries.date, date))
    )
    .limit(1);

  if (existing.length > 0) {
    const newVal = existing[0].painkillerTaken === 1 ? 0 : 1;
    await db
      .update(symptomEntries)
      .set({ painkillerTaken: newVal })
      .where(eq(symptomEntries.id, existing[0].id));
    return newVal === 1;
  } else {
    // Create a minimal entry for this date with painkillerTaken=1
    await db.insert(symptomEntries).values({
      userId,
      date,
      dizziness: 0,
      headache: 0,
      sleepQuality: 5,
      anxiety: 0,
      mood: 5,
      fatigue: 0,
      photosensitivity: 0,
      motionSickness: 0,
      palpitations: 0,
      severeHeadache: 0,
      painkillerTaken: 1,
      triggers: [],
      medications: [],
      notes: null,
    });
    return true;
  }
}

export async function getEntryByUserAndDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(symptomEntries)
    .where(
      and(eq(symptomEntries.userId, userId), eq(symptomEntries.date, date))
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertEntry(
  userId: number,
  data: Omit<InsertSymptomEntry, "id" | "userId" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getEntryByUserAndDate(userId, data.date);

  if (existing) {
    await db
      .update(symptomEntries)
      .set({
        dizziness: data.dizziness,
        headache: data.headache,
        sleepQuality: data.sleepQuality,
        anxiety: data.anxiety,
        fatigue: data.fatigue,
        photosensitivity: data.photosensitivity,
        motionSickness: data.motionSickness,
        palpitations: data.palpitations,
        mood: data.mood,
        medications: data.medications,
        triggers: data.triggers,
        severeHeadache: data.severeHeadache,
        painkillerTaken: data.painkillerTaken,
        painkillerBrand: data.painkillerBrand ?? null,
        painkillerDosage: data.painkillerDosage ?? null,
        notes: data.notes,
      })
      .where(eq(symptomEntries.id, existing.id));

    return { ...existing, ...data };
  } else {
    const result = await db.insert(symptomEntries).values({
      userId,
      ...data,
    });

    return {
      id: Number(result[0].insertId),
      userId,
      ...data,
    };
  }
}

export async function deleteEntryById(userId: number, entryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(symptomEntries)
    .where(
      and(eq(symptomEntries.id, entryId), eq(symptomEntries.userId, userId))
    );
}

// ─── Custom Trigger helpers ──────────────────────────────────────────

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
  data: { enabled: number; reminderHour: number; reminderMinute: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getNotificationSettings(userId);

  if (existing) {
    await db
      .update(notificationSettings)
      .set({
        enabled: data.enabled,
        reminderHour: data.reminderHour,
        reminderMinute: data.reminderMinute,
      })
      .where(eq(notificationSettings.userId, userId));
    return { ...existing, ...data };
  } else {
    const result = await db.insert(notificationSettings).values({
      userId,
      enabled: data.enabled,
      reminderHour: data.reminderHour,
      reminderMinute: data.reminderMinute,
    });
    return {
      id: Number(result[0].insertId),
      userId,
      ...data,
      lastNotifiedDate: null,
    };
  }
}

/**
 * Get the painkiller day limit for a user (from notification_settings).
 * Returns the configured limit or 10 as default.
 */
export async function getPainkillerDayLimit(userId: number): Promise<number> {
  const settings = await getNotificationSettings(userId);
  return settings?.painkillerDayLimit ?? 10;
}

/**
 * Update the painkiller day limit for a user.
 */
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

/**
 * Get painkiller alert enabled status for a user.
 */
export async function getPainkillerAlertEnabled(userId: number): Promise<boolean> {
  const settings = await getNotificationSettings(userId);
  return (settings?.painkillerAlertEnabled ?? 1) === 1;
}

/**
 * Update painkiller alert enabled status for a user.
 */
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

/**
 * Update the last date a painkiller threshold alert was sent for a user.
 */
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

/**
 * Get all users with painkiller alert enabled for threshold checking.
 * Returns userId, painkillerDayLimit, painkillerAlertLastDate.
 */
export async function getUsersForPainkillerAlert(todayStr: string) {
  const db = await getDb();
  if (!db) return [];

  const settings = await db
    .select({
      userId: notificationSettings.userId,
      painkillerDayLimit: notificationSettings.painkillerDayLimit,
      painkillerAlertLastDate: notificationSettings.painkillerAlertLastDate,
    })
    .from(notificationSettings)
    .where(
      and(
        eq(notificationSettings.painkillerAlertEnabled, 1)
      )
    );

  // Filter out users already alerted today
  return settings.filter((s) => s.painkillerAlertLastDate !== todayStr);
}

/**
 * Get all users who have notifications enabled and haven't been notified today.
 * Also checks if they have an entry for today.
 */
export async function getUsersNeedingReminder(todayStr: string) {
  const db = await getDb();
  if (!db) return [];

  // Get all users with notifications enabled
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
  }> = [];

  for (const setting of settings) {
    // Skip if already notified today
    if (setting.lastNotifiedDate === todayStr) continue;

    // Check if user has an entry for today
    const entry = await getEntryByUserAndDate(setting.userId, todayStr);

    // Get user name
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

// ─── Push Subscription helpers ───────────────────────────────────────────

export async function savePushSubscription(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Remove existing subscription with same endpoint for this user
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, subscription.endpoint)
      )
    );

  // Insert new subscription
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

// ─── Custom Metric helpers ──────────────────────────────────────

export async function getCustomMetrics(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(customMetrics)
    .where(eq(customMetrics.userId, userId))
    .orderBy(customMetrics.sortOrder);
}

export async function addCustomMetric(
  userId: number,
  data: { name: string; description?: string; icon?: string; isHighGood?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get next sort order
  const existing = await getCustomMetrics(userId);
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.sortOrder)) + 1 : 0;

  const result = await db.insert(customMetrics).values({
    userId,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? "Activity",
    isHighGood: data.isHighGood ?? 0,
    sortOrder: nextOrder,
  });

  return {
    id: Number(result[0].insertId),
    userId,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? "Activity",
    isHighGood: data.isHighGood ?? 0,
    sortOrder: nextOrder,
  };
}

export async function updateCustomMetric(
  userId: number,
  metricId: number,
  data: { name?: string; description?: string; icon?: string; isHighGood?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.description !== undefined) updateSet.description = data.description;
  if (data.icon !== undefined) updateSet.icon = data.icon;
  if (data.isHighGood !== undefined) updateSet.isHighGood = data.isHighGood;

  await db
    .update(customMetrics)
    .set(updateSet)
    .where(and(eq(customMetrics.id, metricId), eq(customMetrics.userId, userId)));

  return { success: true };
}

export async function deleteCustomMetric(userId: number, metricId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete associated values first
  const metric = await db
    .select()
    .from(customMetrics)
    .where(and(eq(customMetrics.id, metricId), eq(customMetrics.userId, userId)))
    .limit(1);

  if (metric.length > 0) {
    await db
      .delete(customMetricValues)
      .where(eq(customMetricValues.metricId, metricId));
    await db
      .delete(customMetrics)
      .where(and(eq(customMetrics.id, metricId), eq(customMetrics.userId, userId)));
  }
}

export async function getCustomMetricValues(entryId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(customMetricValues)
    .where(eq(customMetricValues.entryId, entryId));
}

export async function upsertCustomMetricValue(
  entryId: number,
  metricId: number,
  value: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if value already exists
  const existing = await db
    .select()
    .from(customMetricValues)
    .where(
      and(
        eq(customMetricValues.entryId, entryId),
        eq(customMetricValues.metricId, metricId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(customMetricValues)
      .set({ value })
      .where(eq(customMetricValues.id, existing[0].id));
  } else {
    await db.insert(customMetricValues).values({
      entryId,
      metricId,
      value,
    });
  }
}

export async function saveCustomMetricValues(
  entryId: number,
  values: Array<{ metricId: number; value: number }>
) {
  for (const v of values) {
    await upsertCustomMetricValue(entryId, v.metricId, v.value);
  }
}

// ─── Backup & Restore helpers ──────────────────────────────────────

/**
 * Export all user data (entries + custom triggers + notification settings) as a single JSON-serializable object.
 */
export async function exportUserData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const entries = await db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(symptomEntries.date);

  const triggers = await db
    .select()
    .from(customTriggers)
    .where(eq(customTriggers.userId, userId));

  const notifSettings = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      date: e.date,
      dizziness: e.dizziness,
      headache: e.headache,
      sleepQuality: e.sleepQuality,
      anxiety: e.anxiety,
      fatigue: e.fatigue,
      photosensitivity: e.photosensitivity,
      motionSickness: e.motionSickness,
      palpitations: e.palpitations,
      mood: e.mood,
      medications: e.medications,
      triggers: e.triggers,
      severeHeadache: e.severeHeadache,
      painkillerTaken: e.painkillerTaken,
      notes: e.notes,
    })),
    customTriggers: triggers.map((t) => ({ name: t.name })),
    notificationSettings: notifSettings.length > 0
      ? {
          enabled: notifSettings[0].enabled,
          reminderHour: notifSettings[0].reminderHour,
          reminderMinute: notifSettings[0].reminderMinute,
        }
      : null,
  };
}

/**
 * Restore user data from a backup JSON object.
 * Upserts entries by date, adds missing triggers, and restores notification settings.
 */
export async function restoreUserData(
  userId: number,
  backup: {
    entries?: Array<{
      date: string;
      dizziness?: number;
      headache?: number;
      sleepQuality?: number;
      anxiety?: number;
      fatigue?: number;
      photosensitivity?: number;
      motionSickness?: number;
      palpitations?: number;
      mood?: number;
      medications?: { name: string; dosage: string }[];
      triggers?: string[];
      severeHeadache?: number;
      painkillerTaken?: number;
      notes?: string | null;
    }>;
    customTriggers?: Array<{ name: string }>;
    notificationSettings?: {
      enabled: number;
      reminderHour: number;
      reminderMinute: number;
    } | null;
  }
) {
  let entriesRestored = 0;
  let triggersRestored = 0;

  // Restore entries
  if (backup.entries && Array.isArray(backup.entries)) {
    for (const entry of backup.entries) {
      if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) continue;
      await upsertEntry(userId, {
        date: entry.date,
        dizziness: entry.dizziness ?? 0,
        headache: entry.headache ?? 0,
        sleepQuality: entry.sleepQuality ?? 5,
        anxiety: entry.anxiety ?? 0,
        fatigue: entry.fatigue ?? 0,
        photosensitivity: entry.photosensitivity ?? 0,
        motionSickness: entry.motionSickness ?? 0,
        palpitations: entry.palpitations ?? 0,
        mood: entry.mood ?? 5,
        medications: entry.medications ?? [],
        triggers: entry.triggers ?? [],
        severeHeadache: entry.severeHeadache ?? 0,
        painkillerTaken: entry.painkillerTaken ?? 0,
        notes: entry.notes ?? null,
      });
      entriesRestored++;
    }
  }

  // Restore custom triggers (skip duplicates)
  if (backup.customTriggers && Array.isArray(backup.customTriggers)) {
    const existingTriggers = await getTriggersByUserId(userId);
    const existingNames = new Set(existingTriggers.map((t) => t.name));
    for (const trigger of backup.customTriggers) {
      if (trigger.name && !existingNames.has(trigger.name)) {
        await addCustomTrigger(userId, trigger.name);
        triggersRestored++;
      }
    }
  }

  // Restore notification settings
  if (backup.notificationSettings) {
    await upsertNotificationSettings(userId, {
      enabled: backup.notificationSettings.enabled ?? 1,
      reminderHour: backup.notificationSettings.reminderHour ?? 21,
      reminderMinute: backup.notificationSettings.reminderMinute ?? 0,
    });
  }

  return { entriesRestored, triggersRestored };
}

// ─── Medication Autocomplete helpers ────────────────────────────────────

/**
 * Get all unique medication name+dosage pairs from a user's history.
 * Returns an array of { name, dosage, count } sorted by frequency (most used first).
 */
export async function getMedicationHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const entries = await db
    .select({ medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId));

  // Collect all medication items and count frequency
  const medMap = new Map<string, { name: string; dosage: string; count: number }>();

  for (const entry of entries) {
    const meds = entry.medications;
    if (!Array.isArray(meds)) continue;
    for (const med of meds) {
      if (!med.name || !med.name.trim()) continue;
      const key = `${med.name.trim()}||${med.dosage?.trim() ?? ""}`;
      const existing = medMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        medMap.set(key, {
          name: med.name.trim(),
          dosage: med.dosage?.trim() ?? "",
          count: 1,
        });
      }
    }
  }

  // Sort by frequency descending
  return Array.from(medMap.values()).sort((a, b) => b.count - a.count);
}

// ─── Alert Rules & History helpers ────────────────────────────────────

import { alertRules, alertHistory } from "../drizzle/schema";

/**
 * Get all alert rules for a user.
 */
export async function getAlertRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertRules).where(eq(alertRules.userId, userId));
}

/**
 * Create a new alert rule.
 */
export async function createAlertRule(data: {
  userId: number;
  metricKey: string;
  threshold: number;
  consecutiveDays: number;
  direction: "above" | "below";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(alertRules).values({
    userId: data.userId,
    metricKey: data.metricKey,
    threshold: data.threshold,
    consecutiveDays: data.consecutiveDays,
    direction: data.direction,
    enabled: 1,
  });
  return result.insertId;
}

/**
 * Update an alert rule.
 */
export async function updateAlertRule(
  ruleId: number,
  userId: number,
  data: Partial<{
    metricKey: string;
    threshold: number;
    consecutiveDays: number;
    direction: "above" | "below";
    enabled: number;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(alertRules)
    .set(data)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.userId, userId)));
}

/**
 * Delete an alert rule.
 */
export async function deleteAlertRule(ruleId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.userId, userId)));
}

/**
 * Check alert rules after saving an entry.
 * Returns an array of triggered alert messages.
 */
export async function checkAlertRules(userId: number, todayStr: string): Promise<{ ruleId: number; metricKey: string; message: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const rules = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.userId, userId), eq(alertRules.enabled, 1)));

  if (rules.length === 0) return [];

  // Get recent entries (up to max consecutiveDays needed)
  const maxDays = Math.max(...rules.map((r) => r.consecutiveDays));
  const entries = await db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(desc(symptomEntries.date))
    .limit(maxDays + 1);

  // Sort by date descending
  const sortedEntries = entries.sort((a, b) => b.date.localeCompare(a.date));

  const SYMPTOM_LABELS: Record<string, string> = {
    dizziness: "头晕脑胀",
    headache: "头痛程度",
    sleepQuality: "睡眠质量",
    anxiety: "焦虑程度",
    fatigue: "疲劳程度",
    photosensitivity: "畏光程度",
    motionSickness: "运动敏感",
    palpitations: "心慌程度",
    mood: "整体心情",
  };

  const triggered: { ruleId: number; metricKey: string; message: string }[] = [];

  for (const rule of rules) {
    // Skip if already triggered today
    if (rule.lastTriggeredDate === todayStr) continue;

    // Check consecutive days
    const recentEntries = sortedEntries.slice(0, rule.consecutiveDays);
    if (recentEntries.length < rule.consecutiveDays) continue;

    // Check if all recent entries exceed the threshold
    const allExceed = recentEntries.every((entry) => {
      const value = (entry as any)[rule.metricKey];
      if (value === undefined || value === null) return false;
      if (rule.direction === "above") return value >= rule.threshold;
      return value <= rule.threshold;
    });

    if (allExceed) {
      const label = SYMPTOM_LABELS[rule.metricKey] || rule.metricKey;
      const dirText = rule.direction === "above" ? "≥" : "≤";
      const message = `⚠️ 预警：「${label}」已连续 ${rule.consecutiveDays} 天${dirText}${rule.threshold}，请注意关注身体状况。`;

      triggered.push({ ruleId: rule.id, metricKey: rule.metricKey, message });

      // Record in alert history
      await db.insert(alertHistory).values({
        userId,
        ruleId: rule.id,
        metricKey: rule.metricKey,
        message,
        triggeredDate: todayStr,
        isRead: 0,
      });

      // Update lastTriggeredDate to prevent duplicate alerts
      await db
        .update(alertRules)
        .set({ lastTriggeredDate: todayStr })
        .where(eq(alertRules.id, rule.id));
    }
  }

  return triggered;
}

/**
 * Get alert history for a user (most recent first).
 */
export async function getAlertHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.userId, userId))
    .orderBy(desc(alertHistory.createdAt))
    .limit(limit);
}

/**
 * Mark all alerts as read for a user.
 */
export async function markAlertsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(alertHistory)
    .set({ isRead: 1 })
    .where(and(eq(alertHistory.userId, userId), eq(alertHistory.isRead, 0)));
}

/**
 * Get unread alert count for a user.
 */
export async function getUnreadAlertCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertHistory)
    .where(and(eq(alertHistory.userId, userId), eq(alertHistory.isRead, 0)));
  return result[0]?.count ?? 0;
}

// ─── Sync Status helpers ──────────────────────────────────────

/**
 * Get sync status for a user: total entries, latest update time, date range.
 */
export async function getSyncStatus(userId: number) {
  const db = await getDb();
  if (!db) return { totalEntries: 0, latestUpdate: null, firstDate: null, lastDate: null };

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId));

  const latestResult = await db
    .select({
      updatedAt: symptomEntries.updatedAt,
      date: symptomEntries.date,
    })
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(desc(symptomEntries.updatedAt))
    .limit(1);

  const firstResult = await db
    .select({ date: symptomEntries.date })
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(symptomEntries.date)
    .limit(1);

  return {
    totalEntries: countResult[0]?.count ?? 0,
    latestUpdate: latestResult[0]?.updatedAt?.toISOString() ?? null,
    lastDate: latestResult[0]?.date ?? null,
    firstDate: firstResult[0]?.date ?? null,
  };
}

// ─── Medication Reminders ──────────────────────────────────────────

/**
 * Get all medication reminders for a user.
 */
export async function getMedicationReminders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId))
    .orderBy(medicationReminders.reminderHour, medicationReminders.reminderMinute);
}

/**
 * Add a new medication reminder.
 */
export async function addMedicationReminder(
  userId: number,
  data: {
    medicationName: string;
    dosage: string;
    reminderHour: number;
    reminderMinute: number;
    reminderTimes?: {hour: number; minute: number}[] | null;
    repeatDays?: number[] | null;
    offsetMinutes?: number;
    stockQuantity?: number | null;
    dailyDosageCount?: number;
    stockAlertDays?: number;
    instructionUrl?: string | null;
    expirationDate?: string | null;
    expirationAlertDays?: number;
    groupId?: number | null;
    intervalHours?: number | null;
    startDate?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return null;
  // If reminderTimes is provided, auto-compute dailyDosageCount from the number of times
  const times = data.reminderTimes;
  const effectiveDailyDosageCount = times && times.length > 0 ? times.length : (data.dailyDosageCount ?? 1);
  const [result] = await db.insert(medicationReminders).values({
    userId,
    medicationName: data.medicationName,
    dosage: data.dosage,
    reminderHour: data.reminderHour,
    reminderMinute: data.reminderMinute,
    reminderTimes: times ?? null,
    repeatDays: data.repeatDays ?? [0, 1, 2, 3, 4, 5, 6],
    offsetMinutes: data.offsetMinutes ?? 0,
    stockQuantity: data.stockQuantity ?? null,
    dailyDosageCount: effectiveDailyDosageCount,
    stockAlertDays: data.stockAlertDays ?? 7,
    instructionUrl: data.instructionUrl ?? null,
    expirationDate: data.expirationDate ?? null,
    expirationAlertDays: data.expirationAlertDays ?? 30,
    groupId: data.groupId ?? null,
    intervalHours: data.intervalHours ?? null,
    startDate: data.startDate ?? null,
    enabled: 1,
  });
  return { id: result.insertId };
}

/**
 * Update a medication reminder.
 */
export async function updateMedicationReminder(
  id: number,
  userId: number,
  data: Partial<{
    medicationName: string;
    dosage: string;
    reminderHour: number;
    reminderMinute: number;
    reminderTimes: {hour: number; minute: number}[] | null;
    enabled: number;
    repeatDays: number[] | null;
    offsetMinutes: number;
    snoozedUntil: string | null;
    stockQuantity: number | null;
    dailyDosageCount: number;
    stockAlertDays: number;
    expirationDate: string | null;
    expirationAlertDays: number;
    groupId: number | null;
    intervalHours: number | null;
    startDate: string | null;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(medicationReminders)
    .set(data)
    .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId)));
}

/**
 * Delete a medication reminder.
 */
export async function deleteMedicationReminder(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(medicationReminders)
    .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId)));
}

/**
 * Get all enabled medication reminders that need to be sent (not yet notified today).
 */
export async function getMedicationRemindersToSend(todayStr: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: medicationReminders.id,
      userId: medicationReminders.userId,
      medicationName: medicationReminders.medicationName,
      dosage: medicationReminders.dosage,
      reminderHour: medicationReminders.reminderHour,
      reminderMinute: medicationReminders.reminderMinute,
      reminderTimes: medicationReminders.reminderTimes,
      repeatDays: medicationReminders.repeatDays,
      offsetMinutes: medicationReminders.offsetMinutes,
      snoozedUntil: medicationReminders.snoozedUntil,
      lastNotifiedDate: medicationReminders.lastNotifiedDate,
      startDate: medicationReminders.startDate,
    })
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.enabled, 1),
        sql`(${medicationReminders.lastNotifiedDate} IS NULL OR ${medicationReminders.lastNotifiedDate} != ${todayStr})`
      )
    );
}

/**
 * Snooze a medication reminder for 15 minutes from now.
 */
export async function snoozeMedicationReminder(id: number, userId: number, snoozeUntil: string) {
  const db = await getDb();
  if (!db) return;
  // Reset lastNotifiedDate so it can fire again, and set snoozedUntil
  await db
    .update(medicationReminders)
    .set({ snoozedUntil: snoozeUntil, lastNotifiedDate: null })
    .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId)));
}

/**
 * Clear snooze after sending the snoozed notification.
 */
export async function clearMedicationSnooze(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(medicationReminders)
    .set({ snoozedUntil: null })
    .where(eq(medicationReminders.id, id));
}

/**
 * Mark a medication reminder as notified for today.
 */
export async function markMedicationReminderNotified(id: number, todayStr: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(medicationReminders)
    .set({ lastNotifiedDate: todayStr })
    .where(eq(medicationReminders.id, id));
}

// ─── Missed Medication Alerts ──────────────────────────────────────────

/**
 * Detect consecutive missed medications.
 * For each active reminder, check the last N days to see if the medication was recorded.
 * Returns alerts for medications missed >= `threshold` consecutive days.
 */
export async function getMissedMedicationAlerts(
  userId: number,
  threshold: number = 3
): Promise<Array<{ reminderId: number; medicationName: string; dosage: string; missedDays: number }>> {
  const db = await getDb();
  if (!db) return [];

  // Get active reminders
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));

  if (reminders.length === 0) return [];

  // Get recent entries (last 14 days should be enough)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const entries = await db
    .select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startStr),
        lte(symptomEntries.date, endStr)
      )
    );

  // Build date -> medication names map
  const entryMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    const meds = entry.medications;
    const names = new Set<string>();
    if (Array.isArray(meds)) {
      for (const m of meds) {
        if (m.name && m.name.trim()) names.add(m.name.trim().toLowerCase());
      }
    }
    entryMap.set(entry.date, names);
  }

  const alerts: Array<{ reminderId: number; medicationName: string; dosage: string; missedDays: number }> = [];

  for (const reminder of reminders) {
    let consecutiveMissed = 0;
    const medName = reminder.medicationName.trim().toLowerCase();

    // Check backwards from yesterday (today might not be recorded yet)
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Skip days not scheduled (repeatDays + startDate)
      if (!isReminderScheduledOnDate(reminder, dateStr)) {
        continue;
      }

      const recordedMeds = entryMap.get(dateStr);
      if (recordedMeds && recordedMeds.has(medName)) {
        break; // Found a day where medication was taken, stop counting
      }

      consecutiveMissed++;
    }

    if (consecutiveMissed >= threshold) {
      alerts.push({
        reminderId: reminder.id,
        medicationName: reminder.medicationName,
        dosage: reminder.dosage,
        missedDays: consecutiveMissed,
      });
    }
  }

  return alerts;
}

// ─── Medication Adherence Statistics ──────────────────────────────────

/**
 * Calculate medication adherence statistics for a user.
 * Compares medication reminders (expected) with actual medication entries (recorded).
 *
 * Returns:
 * - overall adherence rate (percentage)
 * - per-medication adherence breakdown
 * - daily adherence data for charting
 */
export async function getMedicationAdherence(
  userId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return { overallRate: 0, perMedication: [], dailyData: [] };

  // 1. Get all medication reminders for this user (including disabled ones for historical accuracy)
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId));

  if (reminders.length === 0) {
    return { overallRate: 0, perMedication: [], dailyData: [] };
  }

  // 2. Get all symptom entries in the date range
  const entries = await db
    .select({
      date: symptomEntries.date,
      medications: symptomEntries.medications,
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startDate),
        lte(symptomEntries.date, endDate)
      )
    )
    .orderBy(symptomEntries.date);

  // Build a map of date -> recorded medication info (names + reminderIds)
  const entryMap = buildEntryMedMap(entries);

  // 3. For each day in range, check which reminders were expected and which were fulfilled
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  const perMedMap = new Map<
    string,
    { name: string; expected: number; taken: number }
  >();

  const dailyData: Array<{
    date: string;
    expected: number;
    taken: number;
    rate: number;
  }> = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay(); // 0=Sun..6=Sat

    let dayExpected = 0;
    let dayTaken = 0;

    for (const reminder of reminders) {
      // Check if this reminder was scheduled on this date (repeatDays + startDate)
      if (!isReminderScheduledOnDate(reminder, dateStr)) {
        continue; // Not scheduled for this day
      }

      // Only count enabled reminders (or all if we want historical)
      dayExpected++;

      const medName = reminder.medicationName.trim().toLowerCase();
      const recordedMeds = entryMap.get(dateStr);
      const taken = wasMedTaken(recordedMeds, reminder.id, reminder.medicationName);

      if (taken) {
        dayTaken++;
      }

      // Per-medication tracking
      const existing = perMedMap.get(medName);
      if (existing) {
        existing.expected++;
        if (taken) existing.taken++;
      } else {
        perMedMap.set(medName, {
          name: reminder.medicationName,
          expected: 1,
          taken: taken ? 1 : 0,
        });
      }
    }

    if (dayExpected > 0) {
      dailyData.push({
        date: dateStr,
        expected: dayExpected,
        taken: dayTaken,
        rate: Math.round((dayTaken / dayExpected) * 100),
      });
    }
  }

  // 4. Calculate overall rate
  const totalExpected = dailyData.reduce((s, d) => s + d.expected, 0);
  const totalTaken = dailyData.reduce((s, d) => s + d.taken, 0);
  const overallRate = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;

  // 5. Per-medication breakdown
  const perMedication = Array.from(perMedMap.values()).map((m) => ({
    name: m.name,
    expected: m.expected,
    taken: m.taken,
    rate: m.expected > 0 ? Math.round((m.taken / m.expected) * 100) : 0,
  }));

  return { overallRate, perMedication, dailyData };
}

// ─── Medication Stock Management ──────────────────────────────────────

/**
 * Get stock status for all medication reminders of a user.
 * Returns reminders with stock tracking enabled, plus estimated days remaining.
 */
export async function getMedicationStockStatus(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId));

  return reminders
    .filter((r) => r.stockQuantity !== null)
    .map((r) => {
      const dailyCount = r.dailyDosageCount ?? 1;
      const daysRemaining = dailyCount > 0 ? Math.floor((r.stockQuantity ?? 0) / dailyCount) : 999;
      const alertDays = r.stockAlertDays ?? 7;
      const isLow = daysRemaining <= alertDays;
      const estimatedRunOutDate = new Date();
      estimatedRunOutDate.setDate(estimatedRunOutDate.getDate() + daysRemaining);

      return {
        reminderId: r.id,
        medicationName: r.medicationName,
        dosage: r.dosage,
        stockQuantity: r.stockQuantity ?? 0,
        dailyDosageCount: dailyCount,
        daysRemaining,
        estimatedRunOutDate: estimatedRunOutDate.toISOString().slice(0, 10),
        alertDays,
        isLow,
        enabled: r.enabled,
      };
    });
}

/**
 * Deduct stock for a medication (called when user records taking medication).
 * Decrements stockQuantity by the dailyDosageCount.
 */
export async function deductMedicationStock(userId: number, medicationName: string) {
  const db = await getDb();
  if (!db) return;

  // Find matching reminders with stock tracking
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        sql`LOWER(${medicationReminders.medicationName}) = LOWER(${medicationName})`
      )
    );

  for (const r of reminders) {
    if (r.stockQuantity === null) continue; // Not tracking stock
    const deductAmount = r.dailyDosageCount ?? 1;
    const newQuantity = Math.max(0, (r.stockQuantity ?? 0) - deductAmount);
    await db
      .update(medicationReminders)
      .set({ stockQuantity: newQuantity })
      .where(eq(medicationReminders.id, r.id));
  }
}

/**
 * Get low-stock medication alerts for push notifications.
 * Returns medications where stock will run out within alertDays.
 */
export async function getLowStockAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const todayStr = new Date().toISOString().slice(0, 10);

  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    );

  return reminders
    .filter((r) => {
      if (r.stockQuantity === null) return false;
      if (r.lastStockAlertDate === todayStr) return false; // Already alerted today
      const dailyCount = r.dailyDosageCount ?? 1;
      const daysRemaining = dailyCount > 0 ? Math.floor(r.stockQuantity / dailyCount) : 999;
      return daysRemaining <= (r.stockAlertDays ?? 7);
    })
    .map((r) => ({
      reminderId: r.id,
      medicationName: r.medicationName,
      stockQuantity: r.stockQuantity ?? 0,
      dailyDosageCount: r.dailyDosageCount ?? 1,
      daysRemaining: (r.dailyDosageCount ?? 1) > 0
        ? Math.floor((r.stockQuantity ?? 0) / (r.dailyDosageCount ?? 1))
        : 999,
    }));
}

/**
 * Mark a medication reminder's stock alert as sent for today.
 */
export async function markStockAlertSent(id: number) {
  const db = await getDb();
  if (!db) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  await db
    .update(medicationReminders)
    .set({ lastStockAlertDate: todayStr })
    .where(eq(medicationReminders.id, id));
}

/**
 * Get today's medications from reminders — returns the list of medications
 * the user should take today based on their active reminders and repeat days.
 * This allows the symptom form to auto-fill medications from reminders.
 */
export async function getTodayMedications(userId: number, dateStr: string) {
  const db = await getDb();
  if (!db) return [];

  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    )
    .orderBy(medicationReminders.reminderHour, medicationReminders.reminderMinute);

  // Check which day of the week the date falls on
  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay(); // 0=Sun..6=Sat

  // Get today's entry to check which meds are already taken
  const entry = await getEntryByUserAndDate(userId, dateStr);
  const takenMeds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] =
    entry && Array.isArray(entry.medications) ? entry.medications : [];

  const result: Array<{
    name: string;
    dosage: string;
    reminderId: number;
    reminderHour: number;
    reminderMinute: number;
    groupId: number | null;
    taken: boolean;
    timeIndex: number;
    totalTimes: number;
    intervalHours: number | null;
    lastTakenAt: string | null;
    note: string | null;
  }> = [];

  for (const r of reminders) {
    if (!isReminderScheduledOnDate(r, dateStr)) continue;

    // Build the list of all time points for this reminder
    const allTimes = getAllReminderTimes(r);

    for (let ti = 0; ti < allTimes.length; ti++) {
      const t = allTimes[ti];
      // Check if this specific time slot was taken
      const matchedMed = takenMeds.find(
        (m) =>
          (m.reminderId === r.id || m.name.toLowerCase() === r.medicationName.toLowerCase()) &&
          (allTimes.length === 1 || m.timeIndex === ti)
      );
      const taken = !!matchedMed;
      result.push({
        name: r.medicationName,
        dosage: r.dosage,
        reminderId: r.id,
        reminderHour: t.hour,
        reminderMinute: t.minute,
        groupId: r.groupId,
        taken,
        timeIndex: ti,
        totalTimes: allTimes.length,
        intervalHours: r.intervalHours,
        lastTakenAt: r.lastTakenAt,
        note: (matchedMed as any)?.note || null,
      });
    }
  }

  // Sort by time
  result.sort((a, b) => a.reminderHour * 60 + a.reminderMinute - (b.reminderHour * 60 + b.reminderMinute));
  return result;
}

/**
 * Helper: get all reminder times for a medication reminder.
 * If reminderTimes is set, returns that array; otherwise returns [{hour, minute}] from the primary fields.
 */
export function getAllReminderTimes(reminder: { reminderHour: number; reminderMinute: number; reminderTimes?: {hour: number; minute: number}[] | null }): {hour: number; minute: number}[] {
  if (reminder.reminderTimes && Array.isArray(reminder.reminderTimes) && reminder.reminderTimes.length > 0) {
    // Sort by time
    return [...reminder.reminderTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }
  return [{ hour: reminder.reminderHour, minute: reminder.reminderMinute }];
}

/**
 * Check if a medication reminder is scheduled on a given date.
 * Considers both repeatDays (day of week) and startDate (medication start date).
 * Returns false if the date is before the reminder's startDate or not in repeatDays.
 */
export function isReminderScheduledOnDate(
  reminder: { repeatDays?: number[] | null; startDate?: string | null },
  dateStr: string
): boolean {
  // Check startDate: if the date is before the start date, not scheduled
  if (reminder.startDate && dateStr < reminder.startDate) {
    return false;
  }
  // Check repeatDays
  const dayDate = new Date(dateStr + "T00:00:00");
  const dayOfWeek = dayDate.getDay();
  const days = reminder.repeatDays;
  if (days && Array.isArray(days) && days.length > 0 && !days.includes(dayOfWeek)) {
    return false;
  }
  return true;
}

/**
 * Confirm medication taken: record medication in today's symptom entry
 * and deduct stock. Used by push notification "已服药" action.
 * If no entry exists for today, creates a minimal one with just the medication.
 */
export async function confirmMedicationTaken(
  userId: number,
  reminderId: number,
  timeIndex?: number,
  note?: string,
  date?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the reminder details
  const reminder = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.id, reminderId),
        eq(medicationReminders.userId, userId)
      )
    )
    .limit(1);

  if (reminder.length === 0) {
    throw new Error("Reminder not found");
  }

  const med = reminder[0];
  const todayStr = date || (() => {
    const now = new Date();
    const offset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(now.getTime() + offset);
    return chinaTime.toISOString().slice(0, 10);
  })();

  const allTimes = getAllReminderTimes(med);
  const effectiveTimeIndex = timeIndex ?? 0;

  // Check if there's already an entry for the target date
  const existing = await getEntryByUserAndDate(userId, todayStr);

  const newMed: { name: string; dosage: string; reminderId: number; timeIndex?: number; note?: string } = {
    name: med.medicationName,
    dosage: med.dosage,
    reminderId: med.id,
    ...(allTimes.length > 1 ? { timeIndex: effectiveTimeIndex } : {}),
    ...(note ? { note } : {}),
  };

  if (existing) {
    // Append medication if not already recorded for this time slot
    const currentMeds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] = Array.isArray(existing.medications)
      ? existing.medications
      : [];
    const alreadyRecorded = currentMeds.some(
      (m) =>
        (m.reminderId === med.id || m.name.toLowerCase() === newMed.name.toLowerCase()) &&
        (allTimes.length === 1 || m.timeIndex === effectiveTimeIndex)
    );
    if (!alreadyRecorded) {
      const updatedMeds = [...currentMeds, newMed];
      await db
        .update(symptomEntries)
        .set({ medications: updatedMeds })
        .where(eq(symptomEntries.id, existing.id));
    }
  } else {
    // Create a minimal entry for today with just this medication
    await db.insert(symptomEntries).values({
      userId,
      date: todayStr,
      dizziness: 0,
      headache: 0,
      sleepQuality: 5,
      anxiety: 0,
      fatigue: 0,
      photosensitivity: 0,
      motionSickness: 0,
      palpitations: 0,
      mood: 5,
      medications: [newMed],
      triggers: [],
      severeHeadache: 0,
      painkillerTaken: 0,
      notes: null,
    });
  }

  // Deduct stock (one dose per confirmation)
  await deductMedicationStock(userId, med.medicationName);

  // Update lastTakenAt for interval-based reminders
  const nowISO = new Date().toISOString();
  await db
    .update(medicationReminders)
    .set({ lastTakenAt: nowISO })
    .where(eq(medicationReminders.id, reminderId));

  return {
    success: true,
    medicationName: med.medicationName,
    dosage: med.dosage,
    date: todayStr,
    timeIndex: effectiveTimeIndex,
  };
}

/**
 * Unconfirm medication taken: remove medication from today's symptom entry
 * and restore stock quantity.
 */
export async function unconfirmMedicationTaken(
  userId: number,
  reminderId: number,
  timeIndex?: number,
  date?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the reminder details
  const reminder = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.id, reminderId),
        eq(medicationReminders.userId, userId)
      )
    )
    .limit(1);

  if (reminder.length === 0) {
    throw new Error("Reminder not found");
  }

  const med = reminder[0];
  const allTimes = getAllReminderTimes(med);
  const effectiveTimeIndex = timeIndex ?? 0;

  const todayStr = date || (() => {
    const now = new Date();
    const offset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(now.getTime() + offset);
    return chinaTime.toISOString().slice(0, 10);
  })();

  // Get the target date's entry
  const existing = await getEntryByUserAndDate(userId, todayStr);
  if (!existing) {
    return { success: true, medicationName: med.medicationName };
  }

  const currentMeds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] =
    Array.isArray(existing.medications) ? existing.medications : [];

  // Remove the specific time slot's medication record
  const updatedMeds = currentMeds.filter((m) => {
    const isMatch = m.reminderId === med.id || m.name.toLowerCase() === med.medicationName.toLowerCase();
    if (!isMatch) return true; // keep non-matching meds
    // For single-time reminders, remove any match
    if (allTimes.length === 1) return false;
    // For multi-time reminders, only remove the specific timeIndex
    return m.timeIndex !== effectiveTimeIndex;
  });

  if (updatedMeds.length < currentMeds.length) {
    await db
      .update(symptomEntries)
      .set({ medications: updatedMeds })
      .where(eq(symptomEntries.id, existing.id));

    // Restore stock (one dose per unconfirmation)
    if (med.stockQuantity !== null) {
      await db
        .update(medicationReminders)
        .set({ stockQuantity: (med.stockQuantity ?? 0) + 1 })
        .where(eq(medicationReminders.id, med.id));
    }
  }

  return {
    success: true,
    medicationName: med.medicationName,
  };
}

/**
 * Get medication timeline data for a date range.
 * Returns per-day, per-medication taken/missed status for timeline visualization.
 */
export async function getMedicationTimeline(
  userId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return { medications: [], days: [] };

  // Get all medication reminders
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.userId, userId));

  if (reminders.length === 0) {
    return { medications: [], days: [] };
  }

  // Get all symptom entries in the date range
  const entries = await db
    .select({
      date: symptomEntries.date,
      medications: symptomEntries.medications,
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startDate),
        lte(symptomEntries.date, endDate)
      )
    )
    .orderBy(symptomEntries.date);

  // Build a map of date -> recorded medication info (names + reminderIds)
  const entryMap = buildEntryMedMap(entries);

  // Unique medication names
  const medicationNames = reminders.map((r) => r.medicationName);

  // Build timeline data
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  const days: Array<{
    date: string;
    medications: Array<{
      name: string;
      status: "taken" | "missed" | "not-scheduled";
    }>;
  }> = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay();
    const recordedMeds = entryMap.get(dateStr);

    const dayMeds = reminders.map((reminder) => {
      // Check if scheduled for this day (repeatDays + startDate)
      if (!isReminderScheduledOnDate(reminder, dateStr)) {
        return {
          name: reminder.medicationName,
          status: "not-scheduled" as const,
        };
      }

      const taken = wasMedTaken(recordedMeds, reminder.id, reminder.medicationName);

      return {
        name: reminder.medicationName,
        status: taken ? ("taken" as const) : ("missed" as const),
      };
    });

    days.push({ date: dateStr, medications: dayMeds });
  }

  return { medications: medicationNames, days };
}

/**
 * Get medication check-in calendar data for a given month.
 * Returns per-day check-in status: "all-taken" | "partial" | "missed" | "no-schedule"
 * Also computes streak (consecutive all-taken days up to today) and monthly rate.
 */
export async function getMedicationCheckInCalendar(
  userId: number,
  year: number,
  month: number // 1-12
) {
  const db = await getDb();
  if (!db) return { days: [], streak: 0, monthlyRate: 0, totalScheduled: 0, totalCompleted: 0 };

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Get all medication reminders
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    );

  if (reminders.length === 0) {
    return { days: [], streak: 0, monthlyRate: 0, totalScheduled: 0, totalCompleted: 0 };
  }

  // Get all symptom entries in the month
  const entries = await db
    .select({
      date: symptomEntries.date,
      medications: symptomEntries.medications,
      painkillerTaken: symptomEntries.painkillerTaken,
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startDate),
        lte(symptomEntries.date, endDate)
      )
    );

  // Build a map of date -> painkillerTaken
  const painkillerMap = new Map<string, boolean>();
  for (const entry of entries) {
    painkillerMap.set(entry.date, entry.painkillerTaken === 1);
  }

  // Build a map of date -> recorded medication info (names + reminderIds)
  const entryMap = buildEntryMedMap(entries);

  // Today's date string for limiting future dates
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build per-day check-in data
  type DayStatus = {
    date: string;
    status: "all-taken" | "partial" | "missed" | "no-schedule" | "future";
    scheduledCount: number;
    takenCount: number;
    painkillerTaken: boolean;
  };

  const days: DayStatus[] = [];
  let totalScheduled = 0;
  let totalCompleted = 0;

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayDate = new Date(year, month - 1, d);
    const dayOfWeek = dayDate.getDay();

    // Future dates
    if (dateStr > todayStr) {
      days.push({ date: dateStr, status: "future", scheduledCount: 0, takenCount: 0, painkillerTaken: false });
      continue;
    }

    // Count scheduled medications for this day (considering repeatDays + startDate)
    const scheduledReminders: { id: number; name: string }[] = [];
    for (const reminder of reminders) {
      if (isReminderScheduledOnDate(reminder, dateStr)) {
        scheduledReminders.push({ id: reminder.id, name: reminder.medicationName });
      }
    }

    if (scheduledReminders.length === 0) {
      days.push({ date: dateStr, status: "no-schedule", scheduledCount: 0, takenCount: 0, painkillerTaken: painkillerMap.get(dateStr) ?? false });
      continue;
    }

    // Count taken medications using reminderId + name matching
    const recordedMeds = entryMap.get(dateStr);
    let takenCount = 0;
    for (const med of scheduledReminders) {
      if (wasMedTaken(recordedMeds, med.id, med.name)) {
        takenCount++;
      }
    }

    totalScheduled += scheduledReminders.length;
    totalCompleted += takenCount;

    let status: "all-taken" | "partial" | "missed";
    if (takenCount === scheduledReminders.length) {
      status = "all-taken";
    } else if (takenCount > 0) {
      status = "partial";
    } else {
      status = "missed";
    }

    days.push({ date: dateStr, status, scheduledCount: scheduledReminders.length, takenCount, painkillerTaken: painkillerMap.get(dateStr) ?? false });
  }

  // Calculate streak: consecutive "all-taken" days ending at today (or yesterday if today has no data yet)
  let streak = 0;
  // Walk backwards from today
  const todayIndex = days.findIndex((d) => d.date === todayStr);
  if (todayIndex >= 0) {
    for (let i = todayIndex; i >= 0; i--) {
      const day = days[i];
      if (day.status === "all-taken") {
        streak++;
      } else if (day.status === "no-schedule") {
        // Skip non-scheduled days, don't break streak
        continue;
      } else {
        break;
      }
    }
  }

  const monthlyRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  return { days, streak, monthlyRate, totalScheduled, totalCompleted };
}

/**
 * Get medications that are expiring soon or already expired.
 * Returns reminders where expirationDate is within alertDays of today or already past.
 */
export async function getExpiringMedications(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    );

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return reminders
    .filter((r) => r.expirationDate)
    .map((r) => {
      const expDate = new Date(r.expirationDate! + "T00:00:00");
      const diffMs = expDate.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const alertDays = r.expirationAlertDays ?? 30;
      const isExpired = daysUntilExpiry < 0;
      const isExpiringSoon = !isExpired && daysUntilExpiry <= alertDays;
      return {
        ...r,
        daysUntilExpiry,
        isExpired,
        isExpiringSoon,
      };
    })
    .filter((r) => r.isExpired || r.isExpiringSoon);
}

/**
 * Check expiring medications and send push notifications.
 * Called by the scheduler.
 */
export async function checkExpiringMedications() {
  const db = await getDb();
  if (!db) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Get all enabled reminders with expiration dates
  const allReminders = await db
    .select()
    .from(medicationReminders)
    .where(eq(medicationReminders.enabled, 1));

  for (const reminder of allReminders) {
    if (!reminder.expirationDate) continue;
    // Skip if already alerted today
    if (reminder.lastExpirationAlertDate === todayStr) continue;

    const expDate = new Date(reminder.expirationDate + "T00:00:00");
    const diffMs = expDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const alertDays = reminder.expirationAlertDays ?? 30;

    if (daysUntilExpiry <= alertDays) {
      // Send push notification
      const subs = await getPushSubscriptionsByUserId(reminder.userId);
      if (subs.length > 0) {
        const isExpired = daysUntilExpiry < 0;
        const title = isExpired
          ? `⚠️ ${reminder.medicationName} 已过期`
          : `⏰ ${reminder.medicationName} 即将过期`;
        const body = isExpired
          ? `该药品已过期 ${Math.abs(daysUntilExpiry)} 天，请及时更换。`
          : `该药品将在 ${daysUntilExpiry} 天后过期（${reminder.expirationDate}），请注意补充。`;

        try {
          const webpush = await import("web-push");
            const vapidPublicKey = ENV.vapidPublicKey;
            const vapidPrivateKey = ENV.vapidPrivateKey;
          if (vapidPublicKey && vapidPrivateKey) {
            webpush.setVapidDetails(
              "mailto:symptom-tracker@example.com",
              vapidPublicKey,
              vapidPrivateKey
            );
            for (const sub of subs) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  JSON.stringify({ title, body, tag: `expiry-${reminder.id}` })
                );
              } catch (err: any) {
                if (err.statusCode === 410) {
                  await removePushSubscription(reminder.userId, sub.endpoint);
                }
              }
            }
          }
        } catch (err) {
          console.error("[Expiry] Push notification error:", err);
        }
      }

      // Mark as alerted today
      await db
        .update(medicationReminders)
        .set({ lastExpirationAlertDate: todayStr })
        .where(eq(medicationReminders.id, reminder.id));
    }
  }
}

/**
 * Get check-in calendar data with per-medication detail for a specific day.
 * Returns which medications were taken and which were missed.
 */
export async function getMedicationCheckInDayDetail(
  userId: number,
  date: string // YYYY-MM-DD
) {
  const db = await getDb();
  if (!db) return { scheduled: [], taken: [], missed: [] };

  const dayDate = new Date(date + "T00:00:00");
  const dayOfWeek = dayDate.getDay();

  // Get all enabled medication reminders
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    );

  // Find scheduled medications for this day (considering repeatDays + startDate)
  const scheduled: { name: string; dosage: string; id: number }[] = [];
  for (const r of reminders) {
    if (isReminderScheduledOnDate(r, date)) {
      scheduled.push({ name: r.medicationName, dosage: r.dosage, id: r.id });
    }
  }

  if (scheduled.length === 0) {
    // Even with no scheduled meds, we still want headache/painkiller data
    const noSchedEntries = await db
      .select({
        headacheAttack: symptomEntries.severeHeadache,
        painkillerTaken: symptomEntries.painkillerTaken,
      })
      .from(symptomEntries)
      .where(
        and(
          eq(symptomEntries.userId, userId),
          eq(symptomEntries.date, date)
        )
      )
      .limit(1);
    const ha = noSchedEntries.length > 0 ? (noSchedEntries[0].headacheAttack ?? 0) : 0;
    const pt = noSchedEntries.length > 0 ? (noSchedEntries[0].painkillerTaken === 1) : false;
    return { scheduled: [], taken: [], missed: [], headacheAttack: ha, painkillerTaken: pt };
  }

  // Get the symptom entry for this date
  const entries = await db
    .select({
      medications: symptomEntries.medications,
      headacheAttack: symptomEntries.severeHeadache,
      painkillerTaken: symptomEntries.painkillerTaken,
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        eq(symptomEntries.date, date)
      )
    )
    .limit(1);

  // Build match info from recorded medications and collect notes
  const recordedNames = new Set<string>();
  const recordedReminderIds = new Set<number>();
  const notesByReminderId = new Map<number, string>();
  const notesByName = new Map<string, string>();
  if (entries.length > 0 && Array.isArray(entries[0].medications)) {
    for (const m of entries[0].medications as { name: string; dosage: string; reminderId?: number; note?: string }[]) {
      if (m.name && m.name.trim()) {
        recordedNames.add(m.name.trim().toLowerCase());
        if (m.note) notesByName.set(m.name.trim().toLowerCase(), m.note);
      }
      if (m.reminderId) {
        recordedReminderIds.add(m.reminderId);
        if (m.note) notesByReminderId.set(m.reminderId, m.note);
      }
    }
  }

  const matchInfo = { names: recordedNames, reminderIds: recordedReminderIds, reminderTimeKeys: new Set<string>() };

  const taken: { name: string; dosage: string; id: number; note?: string }[] = [];
  const missed: { name: string; dosage: string; id: number }[] = [];

  for (const med of scheduled) {
    if (wasMedTaken(matchInfo, med.id, med.name)) {
      const note = notesByReminderId.get(med.id) || notesByName.get(med.name.trim().toLowerCase());
      taken.push({ ...med, ...(note ? { note } : {}) });
    } else {
      missed.push(med);
    }
  }

  const headacheAttack = entries.length > 0 ? (entries[0].headacheAttack ?? 0) : 0;
  const painkillerTaken = entries.length > 0 ? (entries[0].painkillerTaken === 1) : false;

  return { scheduled, taken, missed, headacheAttack, painkillerTaken };
}

/**
 * Batch update medication reminders — update multiple reminders at once.
 * Supports batch enable/disable and batch time change.
 */
export async function batchUpdateMedicationReminders(
  userId: number,
  ids: number[],
  data: Partial<{
    enabled: number;
    reminderHour: number;
    reminderMinute: number;
  }>
) {
  const db = await getDb();
  if (!db) return;
  if (ids.length === 0) return;

  await db
    .update(medicationReminders)
    .set(data)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        inArray(medicationReminders.id, ids)
      )
    );
}

// ─── Medication Groups ──────────────────────────────────────────────────

/**
 * Get all medication groups for a user, ordered by sortOrder.
 */
export async function getMedicationGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(medicationGroups)
    .where(eq(medicationGroups.userId, userId))
    .orderBy(medicationGroups.sortOrder, medicationGroups.createdAt);
}

/**
 * Create a new medication group.
 */
export async function createMedicationGroup(
  userId: number,
  data: { name: string; icon?: string; color?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get max sortOrder for this user
  const existing = await db
    .select({ maxSort: sql<number>`COALESCE(MAX(${medicationGroups.sortOrder}), 0)` })
    .from(medicationGroups)
    .where(eq(medicationGroups.userId, userId));
  const nextSort = (existing[0]?.maxSort ?? 0) + 1;

  const result = await db.insert(medicationGroups).values({
    userId,
    name: data.name,
    icon: data.icon ?? "Pill",
    color: data.color ?? "sage",
    sortOrder: nextSort,
  });

  return { id: result[0].insertId, name: data.name };
}

/**
 * Update a medication group.
 */
export async function updateMedicationGroup(
  userId: number,
  groupId: number,
  data: Partial<{ name: string; icon: string; color: string; sortOrder: number }>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(medicationGroups)
    .set(data)
    .where(
      and(
        eq(medicationGroups.id, groupId),
        eq(medicationGroups.userId, userId)
      )
    );
}

/**
 * Delete a medication group and ungroup its medications.
 */
export async function deleteMedicationGroup(userId: number, groupId: number) {
  const db = await getDb();
  if (!db) return;

  // Ungroup all medications in this group
  await db
    .update(medicationReminders)
    .set({ groupId: null })
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.groupId, groupId)
      )
    );

  // Delete the group
  await db
    .delete(medicationGroups)
    .where(
      and(
        eq(medicationGroups.id, groupId),
        eq(medicationGroups.userId, userId)
      )
    );
}

/**
 * Assign a medication reminder to a group (or ungroup by passing null).
 */
export async function assignMedicationToGroup(
  userId: number,
  reminderId: number,
  groupId: number | null
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(medicationReminders)
    .set({ groupId })
    .where(
      and(
        eq(medicationReminders.id, reminderId),
        eq(medicationReminders.userId, userId)
      )
    );
}

/**
 * Batch assign multiple medications to a group.
 */
export async function batchAssignMedicationsToGroup(
  userId: number,
  reminderIds: number[],
  groupId: number | null
) {
  const db = await getDb();
  if (!db) return;
  if (reminderIds.length === 0) return;
  await db
    .update(medicationReminders)
    .set({ groupId })
    .where(
      and(
        eq(medicationReminders.userId, userId),
        inArray(medicationReminders.id, reminderIds)
      )
    );
}

/**
 * Get medication reminders grouped by their group.
 * Returns groups with their medications, plus an "ungrouped" list.
 */
export async function getMedicationRemindersGrouped(userId: number) {
  const db = await getDb();
  if (!db) return { groups: [], ungrouped: [] };

  const [groups, reminders] = await Promise.all([
    db
      .select()
      .from(medicationGroups)
      .where(eq(medicationGroups.userId, userId))
      .orderBy(medicationGroups.sortOrder, medicationGroups.createdAt),
    db
      .select()
      .from(medicationReminders)
      .where(eq(medicationReminders.userId, userId))
      .orderBy(medicationReminders.reminderHour, medicationReminders.reminderMinute),
  ]);

  const grouped = groups.map((g) => ({
    ...g,
    medications: reminders.filter((r) => r.groupId === g.id),
  }));

  const ungrouped = reminders.filter((r) => !r.groupId);

  return { groups: grouped, ungrouped };
}

/**
 * Confirm all medications in a group as taken for today.
 * Creates/updates symptom entry and deducts stock for each medication.
 */
export async function confirmGroupMedicationsTaken(
  userId: number,
  groupId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all enabled medications in this group
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.groupId, groupId),
        eq(medicationReminders.enabled, 1)
      )
    );

  if (reminders.length === 0) {
    return { confirmed: 0, skipped: 0 };
  }

  const todayStr = (() => {
    const now = new Date();
    const offset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(now.getTime() + offset);
    return chinaTime.toISOString().slice(0, 10);
  })();

  // Filter to medications scheduled for today (considering repeatDays + startDate)
  const scheduledReminders = reminders.filter((r) => isReminderScheduledOnDate(r, todayStr));

  if (scheduledReminders.length === 0) {
    return { confirmed: 0, skipped: 0 };
  }

  // Get or create today's entry
  const existing = await getEntryByUserAndDate(userId, todayStr);
  const currentMeds: { name: string; dosage: string; reminderId?: number }[] = existing
    ? (Array.isArray(existing.medications) ? existing.medications as any : [])
    : [];

  let confirmed = 0;
  let skipped = 0;

  for (const med of scheduledReminders) {
    const alreadyRecorded = currentMeds.some(
      (m) => m.reminderId === med.id || m.name.toLowerCase() === med.medicationName.toLowerCase()
    );
    if (alreadyRecorded) {
      skipped++;
      continue;
    }
    currentMeds.push({
      name: med.medicationName,
      dosage: med.dosage,
      reminderId: med.id,
    });
    confirmed++;
    // Deduct stock
    await deductMedicationStock(userId, med.medicationName);
  }

  if (confirmed > 0) {
    if (existing) {
      await db
        .update(symptomEntries)
        .set({ medications: currentMeds })
        .where(eq(symptomEntries.id, existing.id));
    } else {
      await db.insert(symptomEntries).values({
        userId,
        date: todayStr,
        dizziness: 0,
        headache: 0,
        sleepQuality: 5,
        anxiety: 0,
        fatigue: 0,
        photosensitivity: 0,
        motionSickness: 0,
        palpitations: 0,
        mood: 5,
        medications: currentMeds,
        triggers: [],
        severeHeadache: 0,
        painkillerTaken: 0,
        notes: null,
      });
    }
  }

  return { confirmed, skipped };
}


// ========== Interval-based Reminders ==========

/**
 * Get the next dose time for an interval-based medication.
 * Returns null if not in interval mode.
 */
export function getNextIntervalDoseTime(
  intervalHours: number | null,
  lastTakenAt: string | null
): { nextDoseAt: Date; minutesUntil: number } | null {
  if (!intervalHours) return null;

  const now = new Date();

  if (!lastTakenAt) {
    // Never taken — next dose is NOW
    return { nextDoseAt: now, minutesUntil: 0 };
  }

  const lastTaken = new Date(lastTakenAt);
  const nextDoseAt = new Date(lastTaken.getTime() + intervalHours * 60 * 60 * 1000);
  const minutesUntil = Math.round((nextDoseAt.getTime() - now.getTime()) / (1000 * 60));

  return { nextDoseAt, minutesUntil };
}

/**
 * Get today's medications with interval info for the user.
 * Enhances the existing todayMeds with interval countdown data.
 */
export async function getIntervalMedicationStatus(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    );

  return reminders
    .filter((r) => r.intervalHours !== null && r.intervalHours > 0)
    .map((r) => {
      const intervalInfo = getNextIntervalDoseTime(r.intervalHours, r.lastTakenAt);
      return {
        reminderId: r.id,
        medicationName: r.medicationName,
        dosage: r.dosage,
        intervalHours: r.intervalHours!,
        lastTakenAt: r.lastTakenAt,
        nextDoseAt: intervalInfo?.nextDoseAt.toISOString() ?? null,
        minutesUntil: intervalInfo?.minutesUntil ?? 0,
        isOverdue: (intervalInfo?.minutesUntil ?? 0) <= 0,
        groupId: r.groupId,
      };
    });
}

// ========== Drug Interactions ==========

/**
 * Get all drug interactions for a user.
 */
export async function getDrugInteractions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(drugInteractions)
    .where(eq(drugInteractions.userId, userId))
    .orderBy(drugInteractions.severity);
}

/**
 * Save drug interactions (replace all for a user).
 */
export async function saveDrugInteractions(
  userId: number,
  interactions: Array<{
    drugA: string;
    drugB: string;
    severity: "mild" | "moderate" | "severe";
    description: string;
    recommendation?: string;
    source?: string;
  }>
) {
  const db = await getDb();
  if (!db) return;

  // Delete existing interactions for this user
  await db
    .delete(drugInteractions)
    .where(eq(drugInteractions.userId, userId));

  // Insert new interactions
  if (interactions.length > 0) {
    await db.insert(drugInteractions).values(
      interactions.map((i) => ({
        userId,
        drugA: i.drugA,
        drugB: i.drugB,
        severity: i.severity,
        description: i.description,
        recommendation: i.recommendation ?? null,
        source: i.source ?? "ai",
      }))
    );
  }
}

/**
 * Check for interactions between a specific drug and all other active medications.
 * Returns matching interactions from the database.
 */
export async function checkDrugInteractionsForMed(
  userId: number,
  medicationName: string
) {
  const db = await getDb();
  if (!db) return [];

  const allInteractions = await getDrugInteractions(userId);
  const normalizedName = medicationName.trim().toLowerCase();

  return allInteractions.filter(
    (i) =>
      i.drugA.trim().toLowerCase() === normalizedName ||
      i.drugB.trim().toLowerCase() === normalizedName
  );
}


/**
 * Get medication completion status for a list of dates.
 * Returns a map of date -> status ("all-taken" | "partial" | "missed" | "no-schedule").
 * Used by history view to filter entries by medication completion.
 */
export async function getMedCompletionByDates(
  userId: number,
  dates: string[]
): Promise<Record<string, "all-taken" | "partial" | "missed" | "no-schedule">> {
  const db = await getDb();
  if (!db || dates.length === 0) return {};

  // Get all enabled medication reminders
  const reminders = await db
    .select()
    .from(medicationReminders)
    .where(
      and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.enabled, 1)
      )
    );

  if (reminders.length === 0) {
    const result: Record<string, "no-schedule"> = {};
    dates.forEach((d) => (result[d] = "no-schedule"));
    return result;
  }

  // Get all symptom entries for these dates
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  const entries = await db
    .select({
      date: symptomEntries.date,
      medications: symptomEntries.medications,
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, minDate),
        lte(symptomEntries.date, maxDate)
      )
    );

  const entryMap = buildEntryMedMap(entries);
  const dateSet = new Set(dates);
  const result: Record<string, "all-taken" | "partial" | "missed" | "no-schedule"> = {};

  for (const dateStr of Array.from(dateSet)) {
    const dayDate = new Date(dateStr + "T00:00:00");
    const dayOfWeek = dayDate.getDay();

    // Count scheduled medications for this day (considering repeatDays + startDate)
    const scheduledReminders: { id: number; name: string }[] = [];
    for (const reminder of reminders) {
      if (isReminderScheduledOnDate(reminder, dateStr)) {
        scheduledReminders.push({ id: reminder.id, name: reminder.medicationName });
      }
    }

    if (scheduledReminders.length === 0) {
      result[dateStr] = "no-schedule";
      continue;
    }

    const recordedMeds = entryMap.get(dateStr);
    let takenCount = 0;
    for (const med of scheduledReminders) {
      if (wasMedTaken(recordedMeds, med.id, med.name)) {
        takenCount++;
      }
    }

    if (takenCount === scheduledReminders.length) {
      result[dateStr] = "all-taken";
    } else if (takenCount > 0) {
      result[dateStr] = "partial";
    } else {
      result[dateStr] = "missed";
    }
  }

  return result;
}


// ========== Painkiller Detail ==========

/**
 * Update painkiller brand and dosage for a specific entry.
 * Verifies ownership before updating.
 */
export async function updatePainkillerDetail(
  userId: number,
  entryId: number,
  painkillerBrand: string,
  painkillerDosage: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .update(symptomEntries)
    .set({
      painkillerBrand: painkillerBrand || null,
      painkillerDosage: painkillerDosage || null,
    })
    .where(
      and(
        eq(symptomEntries.id, entryId),
        eq(symptomEntries.userId, userId)
      )
    );

  return result;
}
