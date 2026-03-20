import { and, eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  symptomEntries,
  InsertSymptomEntry,
  customTriggers,
  InsertCustomTrigger,
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
