import { describe, it, expect } from "vitest";
import { getAllReminderTimesForDate, getAllReminderTimes } from "./db/medications";

describe("getAllReminderTimesForDate - date-aware reminder times", () => {
  const baseReminder = {
    reminderHour: 8,
    reminderMinute: 0,
  };

  it("returns current reminderTimes when no timesChangedDate is set", () => {
    const reminder = {
      ...baseReminder,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: null,
      previousReminderTimes: null,
    };
    const result = getAllReminderTimesForDate(reminder, "2026-05-01");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ hour: 8, minute: 0 });
    expect(result[1]).toEqual({ hour: 20, minute: 0 });
  });

  it("returns current reminderTimes for dates ON or AFTER timesChangedDate", () => {
    const reminder = {
      ...baseReminder,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: [{ hour: 8, minute: 0 }],
    };
    // On the change date
    const resultOnDate = getAllReminderTimesForDate(reminder, "2026-05-10");
    expect(resultOnDate).toHaveLength(3);

    // After the change date
    const resultAfter = getAllReminderTimesForDate(reminder, "2026-05-15");
    expect(resultAfter).toHaveLength(3);
  });

  it("returns previousReminderTimes for dates BEFORE timesChangedDate", () => {
    const reminder = {
      ...baseReminder,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: [{ hour: 8, minute: 0 }],
    };
    const result = getAllReminderTimesForDate(reminder, "2026-05-09");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ hour: 8, minute: 0 });
  });

  it("falls back to single primary time when previousReminderTimes is null and date is before change", () => {
    const reminder = {
      ...baseReminder,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: null,
    };
    const result = getAllReminderTimesForDate(reminder, "2026-05-05");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ hour: 8, minute: 0 });
  });

  it("falls back to single primary time when previousReminderTimes is empty array", () => {
    const reminder = {
      ...baseReminder,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: [],
    };
    const result = getAllReminderTimesForDate(reminder, "2026-05-01");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ hour: 8, minute: 0 });
  });

  it("sorts previousReminderTimes correctly", () => {
    const reminder = {
      ...baseReminder,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: [
        { hour: 20, minute: 0 },
        { hour: 8, minute: 0 },
      ],
    };
    const result = getAllReminderTimesForDate(reminder, "2026-05-05");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ hour: 8, minute: 0 });
    expect(result[1]).toEqual({ hour: 20, minute: 0 });
  });
});

describe("getAllReminderTimes - basic (non-date-aware)", () => {
  it("returns reminderTimes when available", () => {
    const result = getAllReminderTimes({
      reminderHour: 8,
      reminderMinute: 0,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
    });
    expect(result).toHaveLength(2);
  });

  it("falls back to single primary time when reminderTimes is null", () => {
    const result = getAllReminderTimes({
      reminderHour: 9,
      reminderMinute: 30,
      reminderTimes: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ hour: 9, minute: 30 });
  });

  it("falls back to single primary time when reminderTimes is empty", () => {
    const result = getAllReminderTimes({
      reminderHour: 10,
      reminderMinute: 0,
      reminderTimes: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ hour: 10, minute: 0 });
  });
});

describe("Scenario: User changes from 1 dose to 2 doses per day", () => {
  it("historical dates show 1 dose, current dates show 2 doses", () => {
    // Simulates: User had 1 dose/day, changed to 2 doses/day on May 10
    const reminder = {
      reminderHour: 8,
      reminderMinute: 0,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: [{ hour: 8, minute: 0 }],
    };

    // May 1-9: should show 1 dose
    for (let d = 1; d <= 9; d++) {
      const dateStr = `2026-05-${String(d).padStart(2, "0")}`;
      const times = getAllReminderTimesForDate(reminder, dateStr);
      expect(times).toHaveLength(1);
    }

    // May 10+: should show 2 doses
    for (let d = 10; d <= 15; d++) {
      const dateStr = `2026-05-${String(d).padStart(2, "0")}`;
      const times = getAllReminderTimesForDate(reminder, dateStr);
      expect(times).toHaveLength(2);
    }
  });

  it("historical dates show 2 doses when downgrading from 3 to 2", () => {
    // Simulates: User had 3 doses/day, changed to 2 doses/day on May 10
    const reminder = {
      reminderHour: 8,
      reminderMinute: 0,
      reminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 20, minute: 0 },
      ],
      timesChangedDate: "2026-05-10",
      previousReminderTimes: [
        { hour: 8, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 20, minute: 0 },
      ],
    };

    // Before change: 3 doses
    const beforeTimes = getAllReminderTimesForDate(reminder, "2026-05-05");
    expect(beforeTimes).toHaveLength(3);

    // After change: 2 doses
    const afterTimes = getAllReminderTimesForDate(reminder, "2026-05-12");
    expect(afterTimes).toHaveLength(2);
  });
});
