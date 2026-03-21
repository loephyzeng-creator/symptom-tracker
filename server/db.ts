import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
    repeatDays?: number[] | null;
    offsetMinutes?: number;
    stockQuantity?: number | null;
    dailyDosageCount?: number;
    stockAlertDays?: number;
    instructionUrl?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(medicationReminders).values({
    userId,
    medicationName: data.medicationName,
    dosage: data.dosage,
    reminderHour: data.reminderHour,
    reminderMinute: data.reminderMinute,
    repeatDays: data.repeatDays ?? [0, 1, 2, 3, 4, 5, 6],
    offsetMinutes: data.offsetMinutes ?? 0,
    stockQuantity: data.stockQuantity ?? null,
    dailyDosageCount: data.dailyDosageCount ?? 1,
    stockAlertDays: data.stockAlertDays ?? 7,
    instructionUrl: data.instructionUrl ?? null,
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
    enabled: number;
    repeatDays: number[] | null;
    offsetMinutes: number;
    snoozedUntil: string | null;
    stockQuantity: number | null;
    dailyDosageCount: number;
    stockAlertDays: number;
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
      repeatDays: medicationReminders.repeatDays,
      offsetMinutes: medicationReminders.offsetMinutes,
      snoozedUntil: medicationReminders.snoozedUntil,
      lastNotifiedDate: medicationReminders.lastNotifiedDate,
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
    const repeatDays: number[] | null = reminder.repeatDays as number[] | null;

    // Check backwards from yesterday (today might not be recorded yet)
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();

      // Skip days not in repeat schedule
      if (repeatDays && repeatDays.length > 0 && !repeatDays.includes(dayOfWeek)) {
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

  // Build a map of date -> recorded medication names (lowercased for matching)
  const entryMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    const meds = entry.medications;
    const names = new Set<string>();
    if (Array.isArray(meds)) {
      for (const m of meds) {
        if (m.name && m.name.trim()) {
          names.add(m.name.trim().toLowerCase());
        }
      }
    }
    entryMap.set(entry.date, names);
  }

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
      // Check if this reminder was active on this day of week
      const repeatDays: number[] | null = reminder.repeatDays as number[] | null;
      if (repeatDays && repeatDays.length > 0 && !repeatDays.includes(dayOfWeek)) {
        continue; // Not scheduled for this day
      }

      // Only count enabled reminders (or all if we want historical)
      dayExpected++;

      const medName = reminder.medicationName.trim().toLowerCase();
      const recordedMeds = entryMap.get(dateStr);
      const wasTaken = recordedMeds ? recordedMeds.has(medName) : false;

      if (wasTaken) {
        dayTaken++;
      }

      // Per-medication tracking
      const existing = perMedMap.get(medName);
      if (existing) {
        existing.expected++;
        if (wasTaken) existing.taken++;
      } else {
        perMedMap.set(medName, {
          name: reminder.medicationName,
          expected: 1,
          taken: wasTaken ? 1 : 0,
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

  return reminders
    .filter((r) => {
      // If repeatDays is null or empty, it means every day
      const days = r.repeatDays;
      if (!days || (Array.isArray(days) && days.length === 0)) return true;
      return Array.isArray(days) && days.includes(dayOfWeek);
    })
    .map((r) => ({
      name: r.medicationName,
      dosage: r.dosage,
      reminderId: r.id,
    }));
}

/**
 * Confirm medication taken: record medication in today's symptom entry
 * and deduct stock. Used by push notification "已服药" action.
 * If no entry exists for today, creates a minimal one with just the medication.
 */
export async function confirmMedicationTaken(
  userId: number,
  reminderId: number
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
  const todayStr = (() => {
    const now = new Date();
    const offset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(now.getTime() + offset);
    return chinaTime.toISOString().slice(0, 10);
  })();

  // Check if there's already an entry for today
  const existing = await getEntryByUserAndDate(userId, todayStr);

  const newMed = { name: med.medicationName, dosage: med.dosage };

  if (existing) {
    // Append medication if not already recorded
    const currentMeds: { name: string; dosage: string }[] = Array.isArray(existing.medications)
      ? existing.medications
      : [];
    const alreadyRecorded = currentMeds.some(
      (m) => m.name.toLowerCase() === newMed.name.toLowerCase()
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
      notes: null,
    });
  }

  // Deduct stock
  await deductMedicationStock(userId, med.medicationName);

  return {
    success: true,
    medicationName: med.medicationName,
    dosage: med.dosage,
    date: todayStr,
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

  // Build a map of date -> recorded medication names (lowercased)
  const entryMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    const meds = entry.medications;
    const names = new Set<string>();
    if (Array.isArray(meds)) {
      for (const m of meds) {
        if (m.name && m.name.trim()) {
          names.add(m.name.trim().toLowerCase());
        }
      }
    }
    entryMap.set(entry.date, names);
  }

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
      // Check if scheduled for this day
      const repeatDays: number[] | null = reminder.repeatDays as number[] | null;
      const isScheduled =
        !repeatDays || repeatDays.length === 0 || repeatDays.includes(dayOfWeek);

      if (!isScheduled) {
        return {
          name: reminder.medicationName,
          status: "not-scheduled" as const,
        };
      }

      const medName = reminder.medicationName.trim().toLowerCase();
      const wasTaken = recordedMeds ? recordedMeds.has(medName) : false;

      return {
        name: reminder.medicationName,
        status: wasTaken ? ("taken" as const) : ("missed" as const),
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
    })
    .from(symptomEntries)
    .where(
      and(
        eq(symptomEntries.userId, userId),
        gte(symptomEntries.date, startDate),
        lte(symptomEntries.date, endDate)
      )
    );

  // Build a map of date -> recorded medication names (lowercased)
  const entryMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    const meds = entry.medications;
    const names = new Set<string>();
    if (Array.isArray(meds)) {
      for (const m of meds) {
        if (m.name && m.name.trim()) {
          names.add(m.name.trim().toLowerCase());
        }
      }
    }
    entryMap.set(entry.date, names);
  }

  // Today's date string for limiting future dates
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build per-day check-in data
  type DayStatus = {
    date: string;
    status: "all-taken" | "partial" | "missed" | "no-schedule" | "future";
    scheduledCount: number;
    takenCount: number;
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
      days.push({ date: dateStr, status: "future", scheduledCount: 0, takenCount: 0 });
      continue;
    }

    // Count scheduled medications for this day
    const scheduledMeds: string[] = [];
    for (const reminder of reminders) {
      const repeatDays: number[] | null = reminder.repeatDays as number[] | null;
      const isScheduled =
        !repeatDays || repeatDays.length === 0 || repeatDays.includes(dayOfWeek);
      if (isScheduled) {
        scheduledMeds.push(reminder.medicationName.trim().toLowerCase());
      }
    }

    if (scheduledMeds.length === 0) {
      days.push({ date: dateStr, status: "no-schedule", scheduledCount: 0, takenCount: 0 });
      continue;
    }

    // Count taken medications
    const recordedMeds = entryMap.get(dateStr);
    let takenCount = 0;
    for (const medName of scheduledMeds) {
      if (recordedMeds && recordedMeds.has(medName)) {
        takenCount++;
      }
    }

    totalScheduled += scheduledMeds.length;
    totalCompleted += takenCount;

    let status: "all-taken" | "partial" | "missed";
    if (takenCount === scheduledMeds.length) {
      status = "all-taken";
    } else if (takenCount > 0) {
      status = "partial";
    } else {
      status = "missed";
    }

    days.push({ date: dateStr, status, scheduledCount: scheduledMeds.length, takenCount });
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
