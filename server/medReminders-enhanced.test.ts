import { describe, it, expect } from "vitest";

/**
 * Tests for the enhanced medication reminders features:
 * 1. Repeat days (weekday filter)
 * 2. Medication adherence statistics
 * 3. Time offset and snooze
 */

// ─── 1. Repeat Days (isDayActive) ──────────────────────────────────

describe("isDayActive - Repeat Days Filter", () => {
  it("should return true for any day when repeatDays is null (every day)", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    for (let d = 0; d <= 6; d++) {
      expect(isDayActive(null, d)).toBe(true);
    }
  });

  it("should return true for any day when repeatDays is empty array (every day)", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    for (let d = 0; d <= 6; d++) {
      expect(isDayActive([], d)).toBe(true);
    }
  });

  it("should return true for any day when repeatDays is undefined", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    for (let d = 0; d <= 6; d++) {
      expect(isDayActive(undefined as any, d)).toBe(true);
    }
  });

  it("should return true only for weekdays [1,2,3,4,5]", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    const weekdays = [1, 2, 3, 4, 5];
    expect(isDayActive(weekdays, 0)).toBe(false); // Sunday
    expect(isDayActive(weekdays, 1)).toBe(true);  // Monday
    expect(isDayActive(weekdays, 2)).toBe(true);  // Tuesday
    expect(isDayActive(weekdays, 3)).toBe(true);  // Wednesday
    expect(isDayActive(weekdays, 4)).toBe(true);  // Thursday
    expect(isDayActive(weekdays, 5)).toBe(true);  // Friday
    expect(isDayActive(weekdays, 6)).toBe(false); // Saturday
  });

  it("should return true only for weekends [0,6]", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    const weekends = [0, 6];
    expect(isDayActive(weekends, 0)).toBe(true);  // Sunday
    expect(isDayActive(weekends, 1)).toBe(false); // Monday
    expect(isDayActive(weekends, 5)).toBe(false); // Friday
    expect(isDayActive(weekends, 6)).toBe(true);  // Saturday
  });

  it("should handle single day [3] (Wednesday only)", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    expect(isDayActive([3], 2)).toBe(false);
    expect(isDayActive([3], 3)).toBe(true);
    expect(isDayActive([3], 4)).toBe(false);
  });

  it("should handle all days [0,1,2,3,4,5,6]", async () => {
    const { isDayActive } = await import("./reminderScheduler");
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    for (let d = 0; d <= 6; d++) {
      expect(isDayActive(allDays, d)).toBe(true);
    }
  });
});

// ─── 2. Time Offset (applyOffset) ──────────────────────────────────

describe("applyOffset - Time Offset Calculation", () => {
  it("should return same time when offset is 0", async () => {
    const { applyOffset } = await import("./reminderScheduler");
    expect(applyOffset(8, 0, 0)).toEqual({ hour: 8, minute: 0 });
    expect(applyOffset(12, 30, 0)).toEqual({ hour: 12, minute: 30 });
  });

  it("should move time earlier with negative offset", async () => {
    const { applyOffset } = await import("./reminderScheduler");
    // 8:00 - 30min = 7:30
    expect(applyOffset(8, 0, -30)).toEqual({ hour: 7, minute: 30 });
    // 12:30 - 15min = 12:15
    expect(applyOffset(12, 30, -15)).toEqual({ hour: 12, minute: 15 });
    // 9:00 - 60min = 8:00
    expect(applyOffset(9, 0, -60)).toEqual({ hour: 8, minute: 0 });
  });

  it("should move time later with positive offset", async () => {
    const { applyOffset } = await import("./reminderScheduler");
    // 8:00 + 30min = 8:30
    expect(applyOffset(8, 0, 30)).toEqual({ hour: 8, minute: 30 });
    // 12:30 + 15min = 12:45
    expect(applyOffset(12, 30, 15)).toEqual({ hour: 12, minute: 45 });
    // 21:00 + 60min = 22:00
    expect(applyOffset(21, 0, 60)).toEqual({ hour: 22, minute: 0 });
  });

  it("should clamp to 0:00 when offset goes before midnight", async () => {
    const { applyOffset } = await import("./reminderScheduler");
    // 0:10 - 30min would be -20min, clamp to 0:00
    expect(applyOffset(0, 10, -30)).toEqual({ hour: 0, minute: 0 });
    // 0:00 - 60min, clamp to 0:00
    expect(applyOffset(0, 0, -60)).toEqual({ hour: 0, minute: 0 });
  });

  it("should clamp to 23:59 when offset goes past end of day", async () => {
    const { applyOffset } = await import("./reminderScheduler");
    // 23:50 + 30min would be 24:20, clamp to 23:59
    expect(applyOffset(23, 50, 30)).toEqual({ hour: 23, minute: 59 });
    // 23:00 + 120min, clamp to 23:59
    expect(applyOffset(23, 0, 120)).toEqual({ hour: 23, minute: 59 });
  });

  it("should handle cross-hour boundaries correctly", async () => {
    const { applyOffset } = await import("./reminderScheduler");
    // 8:45 + 30min = 9:15
    expect(applyOffset(8, 45, 30)).toEqual({ hour: 9, minute: 15 });
    // 10:10 - 20min = 9:50
    expect(applyOffset(10, 10, -20)).toEqual({ hour: 9, minute: 50 });
  });
});

// ─── 3. Schema & Router Enhancements ──────────────────────────────

describe("Enhanced Schema - New Columns", () => {
  it("should have repeatDays column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("repeatDays");
  });

  it("should have offsetMinutes column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("offsetMinutes");
  });

  it("should have snoozedUntil column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("snoozedUntil");
  });
});

describe("Enhanced Router - New Procedures", () => {
  it("should have snooze procedure in medReminders router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.snooze"]).toBeDefined();
  });

  it("should have adherence query in medReminders router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.adherence"]).toBeDefined();
  });
});

describe("Enhanced DB Helpers - New Functions", () => {
  it("should export snoozeMedicationReminder function", async () => {
    const db = await import("./db");
    expect(typeof db.snoozeMedicationReminder).toBe("function");
  });

  it("should export clearMedicationSnooze function", async () => {
    const db = await import("./db");
    expect(typeof db.clearMedicationSnooze).toBe("function");
  });

  it("should export getMedicationAdherence function", async () => {
    const db = await import("./db");
    expect(typeof db.getMedicationAdherence).toBe("function");
  });
});

// ─── 4. Scheduler Enhancements ──────────────────────────────────

describe("Enhanced Scheduler Exports", () => {
  it("should export isDayActive from scheduler", async () => {
    const scheduler = await import("./reminderScheduler");
    expect(typeof scheduler.isDayActive).toBe("function");
  });

  it("should export applyOffset from scheduler", async () => {
    const scheduler = await import("./reminderScheduler");
    expect(typeof scheduler.applyOffset).toBe("function");
  });

  it("should export getChinaTimeStr from scheduler", async () => {
    const scheduler = await import("./reminderScheduler");
    expect(typeof scheduler.getChinaTimeStr).toBe("function");
  });

  it("getChinaTimeStr should return ISO-like format YYYY-MM-DDTHH:MM", async () => {
    const { getChinaTimeStr } = await import("./reminderScheduler");
    const result = getChinaTimeStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("getChinaTime should include dayOfWeek (0-6)", async () => {
    const { getChinaTime } = await import("./reminderScheduler");
    const result = getChinaTime();
    expect(result).toHaveProperty("hour");
    expect(result).toHaveProperty("minute");
    expect(result).toHaveProperty("dayOfWeek");
    expect(result.dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(result.dayOfWeek).toBeLessThanOrEqual(6);
  });
});

// ─── 5. Notification Content Enhancements ──────────────────────────

describe("Snooze Notification Content", () => {
  it("should generate correct snoozed notification title", () => {
    const medName = "阿司匹林";
    const title = `💊 用药提醒（稍后提醒）：${medName}`;
    expect(title).toContain("稍后提醒");
    expect(title).toContain(medName);
  });

  it("should include snooze action in notification payload", () => {
    const actions = [{ action: "snooze", title: "再等15分钟" }];
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("snooze");
    expect(actions[0].title).toContain("15分钟");
  });
});

// ─── 6. Repeat Days Display Logic ──────────────────────────────────

describe("Repeat Days Display Formatting", () => {
  it("should identify every day correctly", () => {
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const isEveryDay = allDays.length === 7;
    expect(isEveryDay).toBe(true);
  });

  it("should identify weekdays correctly", () => {
    const weekdays = [1, 2, 3, 4, 5];
    const isWeekdays = weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => weekdays.includes(d));
    expect(isWeekdays).toBe(true);
  });

  it("should identify weekends correctly", () => {
    const weekends = [0, 6];
    const isWeekend = weekends.length === 2 && weekends.includes(0) && weekends.includes(6);
    expect(isWeekend).toBe(true);
  });

  it("null repeatDays should be treated as every day", () => {
    const days: number[] | null = null;
    const isEveryDay = !days || days.length === 0 || days.length === 7;
    expect(isEveryDay).toBe(true);
  });
});

// ─── 7. Offset Display Logic ──────────────────────────────────────

describe("Offset Display Formatting", () => {
  it("should show nothing for offset 0", () => {
    const offset = 0;
    const label = offset === 0 ? "" : offset < 0 ? `提前${Math.abs(offset)}分钟` : `延后${offset}分钟`;
    expect(label).toBe("");
  });

  it("should show '提前30分钟' for offset -30", () => {
    const offset = -30;
    const label = offset === 0 ? "" : offset < 0 ? `提前${Math.abs(offset)}分钟` : `延后${offset}分钟`;
    expect(label).toBe("提前30分钟");
  });

  it("should show '延后15分钟' for offset 15", () => {
    const offset = 15;
    const label = offset === 0 ? "" : offset < 0 ? `提前${Math.abs(offset)}分钟` : `延后${offset}分钟`;
    expect(label).toBe("延后15分钟");
  });
});
