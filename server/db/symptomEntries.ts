import { and, eq, desc, gte, lte } from "drizzle-orm";
import { symptomEntries, InsertSymptomEntry } from "../../drizzle/schema";
import { getDb } from "./connection";

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

export async function getPainkillerUsageLast30Days(userId: number, fromDate: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const d = new Date(fromDate + "T00:00:00");
  d.setDate(d.getDate() - 29);
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

export async function getWeeklyPainkillerReport(userId: number, todayStr: string) {
  const db = await getDb();
  if (!db) return null;

  const d7 = new Date(todayStr + "T00:00:00");
  d7.setDate(d7.getDate() - 6);
  const start7 = d7.toISOString().slice(0, 10);

  const d30 = new Date(todayStr + "T00:00:00");
  d30.setDate(d30.getDate() - 29);
  const start30 = d30.toISOString().slice(0, 10);

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

  const painkillerWithHeadache = last7Entries.filter(
    (e) => e.painkillerTaken === 1 && (e.headache >= 5 || (e.severeHeadache ?? 0) >= 2)
  ).length;
  const painkillerWithoutHeadache = thisWeekPainkiller - painkillerWithHeadache;

  const painkillerDays30 = entries30.filter((e) => e.painkillerTaken === 1);
  const nonPainkillerDays30 = entries30.filter((e) => e.painkillerTaken !== 1);
  const avgHeadachePainkiller = painkillerDays30.length > 0
    ? painkillerDays30.reduce((sum, e) => sum + e.headache, 0) / painkillerDays30.length
    : 0;
  const avgHeadacheNoPainkiller = nonPainkillerDays30.length > 0
    ? nonPainkillerDays30.reduce((sum, e) => sum + e.headache, 0) / nonPainkillerDays30.length
    : 0;

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

export async function updatePainkillerDetail(
  userId: number,
  entryId: number,
  painkillerBrand: string,
  painkillerDosage: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(symptomEntries)
    .set({
      painkillerBrand: painkillerBrand || null,
      painkillerDosage: painkillerDosage || null,
    })
    .where(
      and(eq(symptomEntries.id, entryId), eq(symptomEntries.userId, userId))
    );
}
