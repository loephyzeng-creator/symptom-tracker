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
