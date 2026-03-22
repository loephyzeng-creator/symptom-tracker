import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, isReminderScheduledOnDate } from "./db";
import { medicationReminders } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const TEST_USER_ID = 888801;
const TEST_USER_ID_2 = 888802;

describe("Medication Reminder endDate and Archive", () => {
  let reminderId1: number;
  let reminderId2: number;
  let reminderId3: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(medicationReminders).where(eq(medicationReminders.userId, TEST_USER_ID));
    await db.delete(medicationReminders).where(eq(medicationReminders.userId, TEST_USER_ID_2));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db.delete(medicationReminders).where(eq(medicationReminders.userId, TEST_USER_ID));
    await db.delete(medicationReminders).where(eq(medicationReminders.userId, TEST_USER_ID_2));
  });

  it("should create a reminder with endDate", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const [result] = await db.insert(medicationReminders).values({
      userId: TEST_USER_ID,
      medicationName: "测试药品A",
      dosage: "10mg",
      reminderHour: 9,
      reminderMinute: 0,
      enabled: 1,
      startDate: "2025-01-01",
      endDate: "2025-06-30",
    }).$returningId();
    reminderId1 = result.id;

    const [row] = await db.select().from(medicationReminders).where(eq(medicationReminders.id, reminderId1));
    expect(row.endDate).toBe("2025-06-30");
    expect(row.startDate).toBe("2025-01-01");
  });

  it("should create a reminder without endDate (null)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const [result] = await db.insert(medicationReminders).values({
      userId: TEST_USER_ID,
      medicationName: "测试药品B",
      dosage: "20mg",
      reminderHour: 10,
      reminderMinute: 0,
      enabled: 1,
      startDate: "2025-01-01",
      endDate: null,
    }).$returningId();
    reminderId2 = result.id;

    const [row] = await db.select().from(medicationReminders).where(eq(medicationReminders.id, reminderId2));
    expect(row.endDate).toBeNull();
  });

  it("should update endDate on an existing reminder", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db.update(medicationReminders)
      .set({ endDate: "2025-12-31" })
      .where(eq(medicationReminders.id, reminderId1));

    const [row] = await db.select().from(medicationReminders).where(eq(medicationReminders.id, reminderId1));
    expect(row.endDate).toBe("2025-12-31");
  });

  it("should clear endDate (restore from archive)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db.update(medicationReminders)
      .set({ endDate: null })
      .where(eq(medicationReminders.id, reminderId1));

    const [row] = await db.select().from(medicationReminders).where(eq(medicationReminders.id, reminderId1));
    expect(row.endDate).toBeNull();
  });

  it("should filter active vs archived reminders by endDate", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const today = new Date().toISOString().slice(0, 10);

    // Set reminderId1 to expired (past endDate)
    await db.update(medicationReminders)
      .set({ endDate: "2024-01-01" })
      .where(eq(medicationReminders.id, reminderId1));

    // Create one with future endDate
    const [result] = await db.insert(medicationReminders).values({
      userId: TEST_USER_ID,
      medicationName: "测试药品C",
      dosage: "5mg",
      reminderHour: 8,
      reminderMinute: 0,
      enabled: 1,
      startDate: "2025-01-01",
      endDate: "2099-12-31",
    }).$returningId();
    reminderId3 = result.id;

    // Fetch all reminders for this user
    const allReminders = await db.select().from(medicationReminders)
      .where(eq(medicationReminders.userId, TEST_USER_ID));

    // Active: no endDate OR endDate >= today
    const active = allReminders.filter(r => !r.endDate || r.endDate >= today);
    // Archived: endDate < today
    const archived = allReminders.filter(r => r.endDate !== null && r.endDate < today);

    // reminderId1 (endDate 2024-01-01) should be archived
    expect(archived.some(r => r.id === reminderId1)).toBe(true);
    // reminderId2 (no endDate) should be active
    expect(active.some(r => r.id === reminderId2)).toBe(true);
    // reminderId3 (endDate 2099-12-31) should be active
    expect(active.some(r => r.id === reminderId3)).toBe(true);
  });

  it("should exclude expired reminders from isReminderScheduledOnDate", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const isScheduled = isReminderScheduledOnDate(
      {
        startDate: "2024-01-01",
        endDate: yesterdayStr,
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        intervalHours: null,
        reminderTimes: null,
      } as any,
      today
    );

    expect(isScheduled).toBe(false);
  });

  it("should allow isReminderScheduledOnDate for reminders with no endDate", () => {
    const today = new Date().toISOString().slice(0, 10);

    const isScheduled = isReminderScheduledOnDate(
      {
        startDate: "2024-01-01",
        endDate: null,
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        intervalHours: null,
        reminderTimes: null,
      } as any,
      today
    );

    expect(isScheduled).toBe(true);
  });

  it("should allow isReminderScheduledOnDate for reminders with future endDate", () => {
    const today = new Date().toISOString().slice(0, 10);

    const isScheduled = isReminderScheduledOnDate(
      {
        startDate: "2024-01-01",
        endDate: "2099-12-31",
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        intervalHours: null,
        reminderTimes: null,
      } as any,
      today
    );

    expect(isScheduled).toBe(true);
  });
});
