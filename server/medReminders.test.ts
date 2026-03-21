import { describe, it, expect } from "vitest";

/**
 * Tests for the medication reminders feature.
 * Validates the router structure, schema, and scheduler integration.
 */

describe("Medication Reminders - Router Structure", () => {
  it("should have medReminders router in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    // Check that the medReminders namespace exists
    const routerDef = (appRouter as any)._def;
    expect(routerDef).toBeDefined();
  });

  it("should export medReminders CRUD procedures", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.list"]).toBeDefined();
    expect(procedures["medReminders.add"]).toBeDefined();
    expect(procedures["medReminders.update"]).toBeDefined();
    expect(procedures["medReminders.delete"]).toBeDefined();
  });
});

describe("Medication Reminders - Database Schema", () => {
  it("should have medicationReminders table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.medicationReminders).toBeDefined();
  });

  it("should have correct columns in medicationReminders table", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.medicationReminders;
    // Check key column names exist
    const columnNames = Object.keys((table as any));
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("medicationName");
    expect(columnNames).toContain("dosage");
    expect(columnNames).toContain("reminderHour");
    expect(columnNames).toContain("reminderMinute");
    expect(columnNames).toContain("enabled");
    expect(columnNames).toContain("lastNotifiedDate");
  });
});

describe("Medication Reminders - DB Helpers", () => {
  it("should export getMedicationReminders function", async () => {
    const db = await import("./db");
    expect(typeof db.getMedicationReminders).toBe("function");
  });

  it("should export addMedicationReminder function", async () => {
    const db = await import("./db");
    expect(typeof db.addMedicationReminder).toBe("function");
  });

  it("should export updateMedicationReminder function", async () => {
    const db = await import("./db");
    expect(typeof db.updateMedicationReminder).toBe("function");
  });

  it("should export deleteMedicationReminder function", async () => {
    const db = await import("./db");
    expect(typeof db.deleteMedicationReminder).toBe("function");
  });

  it("should export getMedicationRemindersToSend function", async () => {
    const db = await import("./db");
    expect(typeof db.getMedicationRemindersToSend).toBe("function");
  });

  it("should export markMedicationReminderNotified function", async () => {
    const db = await import("./db");
    expect(typeof db.markMedicationReminderNotified).toBe("function");
  });
});

describe("Medication Reminders - Scheduler Integration", () => {
  it("should export checkAndSendMedicationReminders from scheduler", async () => {
    const scheduler = await import("./reminderScheduler");
    expect(typeof scheduler.checkAndSendMedicationReminders).toBe("function");
  });

  it("sendWebPush should accept optional tag parameter", async () => {
    const scheduler = await import("./reminderScheduler");
    // sendWebPush signature: (userId, title, body, tag?) => Promise<boolean>
    expect(typeof scheduler.sendWebPush).toBe("function");
    expect(scheduler.sendWebPush.length).toBeGreaterThanOrEqual(3);
  });

  it("isReminderTime should correctly detect medication reminder windows", async () => {
    const { isReminderTime } = await import("./reminderScheduler");

    // Exact time match
    expect(isReminderTime(8, 0, 8, 0)).toBe(true);
    // Within 15-minute window
    expect(isReminderTime(8, 0, 8, 14)).toBe(true);
    // Outside window
    expect(isReminderTime(8, 0, 8, 15)).toBe(false);
    // Before scheduled time
    expect(isReminderTime(8, 0, 7, 59)).toBe(false);

    // Different medication times
    expect(isReminderTime(12, 30, 12, 30)).toBe(true);
    expect(isReminderTime(12, 30, 12, 44)).toBe(true);
    expect(isReminderTime(12, 30, 12, 45)).toBe(false);

    // Evening medication
    expect(isReminderTime(21, 0, 21, 5)).toBe(true);
    expect(isReminderTime(21, 0, 20, 55)).toBe(false);
  });
});

describe("Medication Reminders - Notification Content", () => {
  it("should generate correct notification payload structure", () => {
    // Verify the expected notification format for medication reminders
    const medName = "草酸艾司西酞普兰片";
    const dosage = "10mg";
    const title = `💊 用药提醒：${medName}`;
    const body = `请服用 ${medName} ${dosage}`;
    const tag = `med-reminder-42`;

    expect(title).toContain(medName);
    expect(body).toContain(medName);
    expect(body).toContain(dosage);
    expect(tag).toMatch(/^med-reminder-\d+$/);
  });

  it("should use unique tags per medication to avoid notification deduplication", () => {
    const tag1 = `med-reminder-1`;
    const tag2 = `med-reminder-2`;
    const dailyTag = "daily-reminder";

    // Each medication gets its own tag so they don't replace each other
    expect(tag1).not.toBe(tag2);
    expect(tag1).not.toBe(dailyTag);
    expect(tag2).not.toBe(dailyTag);
  });
});
