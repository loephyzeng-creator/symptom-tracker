import { and, eq, desc, sql } from "drizzle-orm";
import {
  symptomEntries,
  alertRules,
  alertHistory,
} from "../../drizzle/schema";
import { getDb } from "./connection";

export async function getMedicationHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const entries = await db
    .select({ medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId));

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

  return Array.from(medMap.values()).sort((a, b) => b.count - a.count);
}

export async function getAlertRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertRules).where(eq(alertRules.userId, userId));
}

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

export async function deleteAlertRule(ruleId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.userId, userId)));
}

export async function checkAlertRules(userId: number, todayStr: string): Promise<{ ruleId: number; metricKey: string; message: string }[]> {
  const db = await getDb();
  if (!db) return [];

  const rules = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.userId, userId), eq(alertRules.enabled, 1)));

  if (rules.length === 0) return [];

  const maxDays = Math.max(...rules.map((r) => r.consecutiveDays));
  const entries = await db
    .select()
    .from(symptomEntries)
    .where(eq(symptomEntries.userId, userId))
    .orderBy(desc(symptomEntries.date))
    .limit(maxDays + 1);

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
    if (rule.lastTriggeredDate === todayStr) continue;

    const recentEntries = sortedEntries.slice(0, rule.consecutiveDays);
    if (recentEntries.length < rule.consecutiveDays) continue;

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

      await db.insert(alertHistory).values({
        userId,
        ruleId: rule.id,
        metricKey: rule.metricKey,
        message,
        triggeredDate: todayStr,
        isRead: 0,
      });

      await db
        .update(alertRules)
        .set({ lastTriggeredDate: todayStr })
        .where(eq(alertRules.id, rule.id));
    }
  }

  return triggered;
}

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

export async function markAlertsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(alertHistory)
    .set({ isRead: 1 })
    .where(and(eq(alertHistory.userId, userId), eq(alertHistory.isRead, 0)));
}

export async function getUnreadAlertCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertHistory)
    .where(and(eq(alertHistory.userId, userId), eq(alertHistory.isRead, 0)));
  return result[0]?.count ?? 0;
}

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
