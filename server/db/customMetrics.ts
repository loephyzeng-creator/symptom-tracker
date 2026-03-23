import { and, eq } from "drizzle-orm";
import { customMetrics, customMetricValues } from "../../drizzle/schema";
import { getDb } from "./connection";

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
