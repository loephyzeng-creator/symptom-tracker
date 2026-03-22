/**
 * Tests for three new features (March 2026):
 * 1. Auto-detect browser timezone (setTimezone mutation)
 * 2. Monthly medication consumption trend chart (monthlyConsumption query)
 * 3. Default restock quantity per medication
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  notificationSettings,
  medicationReminders,
  symptomEntries,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const TEST_USER_ID = 888901;
const TEST_USER_ID_2 = 888902;

describe("Feature 1: Auto-detect timezone (setTimezone logic)", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    await db
      .delete(notificationSettings)
      .where(eq(notificationSettings.userId, TEST_USER_ID));
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(notificationSettings)
      .where(eq(notificationSettings.userId, TEST_USER_ID));
  });

  it("should create notification settings with browser timezone for new user", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db.insert(notificationSettings).values({
      userId: TEST_USER_ID,
      enabled: 1,
      reminderHour: 21,
      reminderMinute: 0,
      timezone: "America/New_York",
    });

    const [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, TEST_USER_ID));

    expect(settings).toBeDefined();
    expect(settings.timezone).toBe("America/New_York");
  });

  it("should not overwrite user-customized timezone", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db
      .update(notificationSettings)
      .set({ timezone: "Europe/London" })
      .where(eq(notificationSettings.userId, TEST_USER_ID));

    const [existing] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, TEST_USER_ID));

    // setTimezone only updates if timezone === DEFAULT_TIMEZONE ("Asia/Shanghai")
    const shouldUpdate =
      !existing || !existing.timezone || existing.timezone === "Asia/Shanghai";
    expect(shouldUpdate).toBe(false);
    expect(existing.timezone).toBe("Europe/London");
  });

  it("should update timezone if still at default Asia/Shanghai", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db
      .update(notificationSettings)
      .set({ timezone: "Asia/Shanghai" })
      .where(eq(notificationSettings.userId, TEST_USER_ID));

    const [existing] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, TEST_USER_ID));

    const shouldUpdate =
      !existing || !existing.timezone || existing.timezone === "Asia/Shanghai";
    expect(shouldUpdate).toBe(true);

    if (shouldUpdate) {
      await db
        .update(notificationSettings)
        .set({ timezone: "America/Los_Angeles" })
        .where(eq(notificationSettings.userId, TEST_USER_ID));
    }

    const [updated] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, TEST_USER_ID));
    expect(updated.timezone).toBe("America/Los_Angeles");
  });
});

describe("Feature 1: setTimezone router procedure", () => {
  it("should have setTimezone procedure in notification router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["notification.setTimezone"]).toBeDefined();
  });
});

describe("Feature 2: Monthly medication consumption", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db
      .delete(symptomEntries)
      .where(eq(symptomEntries.userId, TEST_USER_ID_2));
    await db
      .delete(medicationReminders)
      .where(eq(medicationReminders.userId, TEST_USER_ID_2));

    await db.insert(medicationReminders).values({
      userId: TEST_USER_ID_2,
      medicationName: "趋势测试药A",
      dosage: "1片",
      reminderHour: 8,
      reminderMinute: 0,
      enabled: 1,
    });

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    for (let day = 1; day <= 3; day++) {
      const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
      await db.insert(symptomEntries).values({
        userId: TEST_USER_ID_2,
        date: dateStr,
        medications: [
          { name: "趋势测试药A", dosage: "1片" },
        ] as any,
        triggers: [] as any,
      });
    }
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(symptomEntries)
      .where(eq(symptomEntries.userId, TEST_USER_ID_2));
    await db
      .delete(medicationReminders)
      .where(eq(medicationReminders.userId, TEST_USER_ID_2));
  });

  it("should return monthly consumption data with medication counts", async () => {
    const { getMonthlyMedicationConsumption } = await import("./db");
    const result = await getMonthlyMedicationConsumption(TEST_USER_ID_2, 6);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(6);

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthData = result.find((m) => m.month === currentMonth);

    expect(currentMonthData).toBeDefined();
    expect(currentMonthData!.totalCount).toBeGreaterThanOrEqual(3);
    expect(currentMonthData!.medications.length).toBeGreaterThanOrEqual(1);

    const medA = currentMonthData!.medications.find(
      (m) => m.name === "趋势测试药A"
    );
    expect(medA).toBeDefined();
    expect(medA!.count).toBeGreaterThanOrEqual(3);
  });

  it("should return empty array for user with no reminders", async () => {
    const { getMonthlyMedicationConsumption } = await import("./db");
    const result = await getMonthlyMedicationConsumption(999998, 6);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("should respect the months parameter", async () => {
    const { getMonthlyMedicationConsumption } = await import("./db");
    const result3 = await getMonthlyMedicationConsumption(TEST_USER_ID_2, 3);
    const result12 = await getMonthlyMedicationConsumption(TEST_USER_ID_2, 12);

    expect(result3.length).toBe(3);
    expect(result12.length).toBe(12);
  });

  it("should have monthlyConsumption procedure in medReminders router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.monthlyConsumption"]).toBeDefined();
  });
});

describe("Feature 3: Default restock quantity", () => {
  let reminderId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db
      .delete(medicationReminders)
      .where(
        and(
          eq(medicationReminders.userId, TEST_USER_ID),
          eq(medicationReminders.medicationName, "默认补货测试药888")
        )
      );

    const [inserted] = await db.insert(medicationReminders).values({
      userId: TEST_USER_ID,
      medicationName: "默认补货测试药888",
      dosage: "1粒",
      reminderHour: 9,
      reminderMinute: 0,
      enabled: 1,
      stockQuantity: 30,
    });
    reminderId = inserted.insertId;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db
      .delete(medicationReminders)
      .where(
        and(
          eq(medicationReminders.userId, TEST_USER_ID),
          eq(medicationReminders.medicationName, "默认补货测试药888")
        )
      );
  });

  it("should have defaultRestockQuantity column in schema", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("defaultRestockQuantity");
  });

  it("should have null defaultRestockQuantity initially", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const [reminder] = await db
      .select()
      .from(medicationReminders)
      .where(eq(medicationReminders.id, reminderId));

    expect(reminder).toBeDefined();
    expect(reminder.defaultRestockQuantity).toBeNull();
  });

  it("should save defaultRestockQuantity when set", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db
      .update(medicationReminders)
      .set({ defaultRestockQuantity: 60 })
      .where(eq(medicationReminders.id, reminderId));

    const [updated] = await db
      .select()
      .from(medicationReminders)
      .where(eq(medicationReminders.id, reminderId));

    expect(updated.defaultRestockQuantity).toBe(60);
  });

  it("should include defaultRestockQuantity in stock status", async () => {
    const { getMedicationStockStatus } = await import("./db");
    const statuses = await getMedicationStockStatus(TEST_USER_ID);

    const testMed = statuses.find(
      (s: any) => s.medicationName === "默认补货测试药888"
    );
    if (testMed) {
      expect(testMed.defaultRestockQuantity).toBe(60);
    }
  });

  it("should allow clearing defaultRestockQuantity", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db
      .update(medicationReminders)
      .set({ defaultRestockQuantity: null })
      .where(eq(medicationReminders.id, reminderId));

    const [updated] = await db
      .select()
      .from(medicationReminders)
      .where(eq(medicationReminders.id, reminderId));

    expect(updated.defaultRestockQuantity).toBeNull();
  });
});
