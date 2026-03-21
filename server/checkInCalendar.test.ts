import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for getMedicationCheckInCalendar function logic.
 * We test the core computation: given reminders and entries, produce correct day statuses, streak, and rate.
 */

// Helper to simulate the calendar logic (mirrors db.ts getMedicationCheckInCalendar)
function computeCheckInCalendar(
  reminders: Array<{
    medicationName: string;
    enabled: boolean;
    repeatDays: number[] | null;
  }>,
  entries: Array<{ date: string; medications: Array<{ name: string }> }>,
  year: number,
  month: number,
  todayStr: string
) {
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const enabledReminders = reminders.filter((r) => r.enabled);
  if (enabledReminders.length === 0) {
    return { days: [], streak: 0, monthlyRate: 0, totalScheduled: 0, totalCompleted: 0 };
  }

  // Build entry map
  const entryMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    const names = new Set<string>();
    for (const m of entry.medications) {
      if (m.name && m.name.trim()) {
        names.add(m.name.trim().toLowerCase());
      }
    }
    entryMap.set(entry.date, names);
  }

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

    if (dateStr > todayStr) {
      days.push({ date: dateStr, status: "future", scheduledCount: 0, takenCount: 0 });
      continue;
    }

    const scheduledMeds: string[] = [];
    for (const reminder of enabledReminders) {
      const repeatDays = reminder.repeatDays;
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

  // Calculate streak
  let streak = 0;
  const todayIndex = days.findIndex((d) => d.date === todayStr);
  if (todayIndex >= 0) {
    for (let i = todayIndex; i >= 0; i--) {
      const day = days[i];
      if (day.status === "all-taken") {
        streak++;
      } else if (day.status === "no-schedule") {
        continue;
      } else {
        break;
      }
    }
  }

  const monthlyRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  return { days, streak, monthlyRate, totalScheduled, totalCompleted };
}

describe("Medication Check-in Calendar", () => {
  describe("Basic status computation", () => {
    it("should return empty when no reminders", () => {
      const result = computeCheckInCalendar([], [], 2026, 3, "2026-03-21");
      expect(result.days).toEqual([]);
      expect(result.streak).toBe(0);
      expect(result.monthlyRate).toBe(0);
    });

    it("should mark all-taken when all medications recorded", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
        { medicationName: "药品B", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-20", medications: [{ name: "药品A" }, { name: "药品B" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("all-taken");
      expect(day20?.takenCount).toBe(2);
      expect(day20?.scheduledCount).toBe(2);
    });

    it("should mark partial when some medications recorded", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
        { medicationName: "药品B", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("partial");
      expect(day20?.takenCount).toBe(1);
      expect(day20?.scheduledCount).toBe(2);
    });

    it("should mark missed when no medications recorded", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const entries: Array<{ date: string; medications: Array<{ name: string }> }> = [];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("missed");
    });

    it("should mark future dates correctly", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const result = computeCheckInCalendar(reminders, [], 2026, 3, "2026-03-15");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("future");
      const day15 = result.days.find((d) => d.date === "2026-03-15");
      expect(day15?.status).not.toBe("future");
    });
  });

  describe("Repeat days filtering", () => {
    it("should mark no-schedule for days not in repeatDays", () => {
      // 2026-03-21 is Saturday (day 6)
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: [1, 2, 3, 4, 5] }, // weekdays only
      ];
      const result = computeCheckInCalendar(reminders, [], 2026, 3, "2026-03-21");
      // March 21 is Saturday
      const day21 = result.days.find((d) => d.date === "2026-03-21");
      expect(day21?.status).toBe("no-schedule");
      // March 20 is Friday (day 5)
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("missed"); // scheduled but not taken
    });

    it("should handle empty repeatDays as every day", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: [] },
      ];
      const result = computeCheckInCalendar(reminders, [], 2026, 3, "2026-03-21");
      // All past days should be missed (scheduled every day)
      const day1 = result.days.find((d) => d.date === "2026-03-01");
      expect(day1?.status).toBe("missed");
    });
  });

  describe("Streak calculation", () => {
    it("should calculate streak of consecutive all-taken days", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-19", medications: [{ name: "药品A" }] },
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
        { date: "2026-03-21", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      expect(result.streak).toBe(3);
    });

    it("should break streak on missed day", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-18", medications: [{ name: "药品A" }] },
        // March 19 missed
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
        { date: "2026-03-21", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      expect(result.streak).toBe(2); // Only 20 and 21
    });

    it("should skip no-schedule days in streak", () => {
      // Weekend-only medication
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: [0, 6] }, // Sun, Sat only
      ];
      // 2026-03-21 is Saturday, 2026-03-15 is Sunday
      const entries = [
        { date: "2026-03-15", medications: [{ name: "药品A" }] }, // Sunday
        { date: "2026-03-21", medications: [{ name: "药品A" }] }, // Saturday
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      // Streak: 21(Sat taken) -> 20(Fri no-schedule skip) -> ... -> 16(Mon no-schedule skip) -> 15(Sun taken)
      expect(result.streak).toBe(2);
    });

    it("should return 0 streak when today is missed", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-19", medications: [{ name: "药品A" }] },
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
        // March 21 not taken
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      expect(result.streak).toBe(0);
    });
  });

  describe("Monthly rate calculation", () => {
    it("should calculate correct monthly rate", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      // 5 days taken out of 21 scheduled (up to March 21)
      const entries = [
        { date: "2026-03-01", medications: [{ name: "药品A" }] },
        { date: "2026-03-05", medications: [{ name: "药品A" }] },
        { date: "2026-03-10", medications: [{ name: "药品A" }] },
        { date: "2026-03-15", medications: [{ name: "药品A" }] },
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      expect(result.totalCompleted).toBe(5);
      expect(result.totalScheduled).toBe(21);
      expect(result.monthlyRate).toBe(24); // 5/21 = 23.8 -> 24%
    });

    it("should return 100% when all taken", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      // All 3 days taken (March 1-3, today is March 3)
      const entries = [
        { date: "2026-03-01", medications: [{ name: "药品A" }] },
        { date: "2026-03-02", medications: [{ name: "药品A" }] },
        { date: "2026-03-03", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-03");
      expect(result.monthlyRate).toBe(100);
      expect(result.totalCompleted).toBe(3);
      expect(result.totalScheduled).toBe(3);
    });
  });

  describe("Disabled reminders", () => {
    it("should ignore disabled reminders", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
        { medicationName: "药品B", enabled: false, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      // Only 药品A is scheduled (药品B disabled), and it was taken
      expect(day20?.status).toBe("all-taken");
      expect(day20?.scheduledCount).toBe(1);
    });
  });

  describe("Case-insensitive matching", () => {
    it("should match medication names case-insensitively", () => {
      const reminders = [
        { medicationName: "Aspirin", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-20", medications: [{ name: "aspirin" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("all-taken");
    });

    it("should trim whitespace in medication names", () => {
      const reminders = [
        { medicationName: " 药品A ", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-20", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day20 = result.days.find((d) => d.date === "2026-03-20");
      expect(day20?.status).toBe("all-taken");
    });
  });

  describe("Multiple medications", () => {
    it("should handle multiple medications with different schedules", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null }, // every day
        { medicationName: "药品B", enabled: true, repeatDays: [1, 2, 3, 4, 5] }, // weekdays
      ];
      // 2026-03-21 is Saturday
      const entries = [
        { date: "2026-03-21", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-21");
      const day21 = result.days.find((d) => d.date === "2026-03-21");
      // Saturday: only 药品A scheduled (药品B is weekday-only), and it was taken
      expect(day21?.status).toBe("all-taken");
      expect(day21?.scheduledCount).toBe(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle month with 28 days (February)", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const result = computeCheckInCalendar(reminders, [], 2026, 2, "2026-02-28");
      expect(result.days.length).toBe(28);
      const lastDay = result.days[result.days.length - 1];
      expect(lastDay?.date).toBe("2026-02-28");
    });

    it("should handle month with 31 days", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const result = computeCheckInCalendar(reminders, [], 2026, 1, "2026-01-31");
      expect(result.days.length).toBe(31);
    });

    it("should return correct data for first day of month", () => {
      const reminders = [
        { medicationName: "药品A", enabled: true, repeatDays: null },
      ];
      const entries = [
        { date: "2026-03-01", medications: [{ name: "药品A" }] },
      ];
      const result = computeCheckInCalendar(reminders, entries, 2026, 3, "2026-03-01");
      expect(result.days[0]?.status).toBe("all-taken");
      expect(result.streak).toBe(1);
      expect(result.monthlyRate).toBe(100);
    });
  });
});
