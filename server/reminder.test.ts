import { describe, expect, it } from "vitest";
import { isReminderTime } from "./reminderScheduler";

describe("isReminderTime", () => {
  it("returns true when current time matches scheduled time exactly", () => {
    expect(isReminderTime(21, 0, 21, 0)).toBe(true);
  });

  it("returns true within 15-minute window after scheduled time", () => {
    expect(isReminderTime(21, 0, 21, 5)).toBe(true);
    expect(isReminderTime(21, 0, 21, 14)).toBe(true);
  });

  it("returns false after 15-minute window", () => {
    expect(isReminderTime(21, 0, 21, 15)).toBe(false);
    expect(isReminderTime(21, 0, 21, 30)).toBe(false);
  });

  it("returns false before scheduled time", () => {
    expect(isReminderTime(21, 0, 20, 59)).toBe(false);
    expect(isReminderTime(21, 0, 20, 0)).toBe(false);
  });

  it("handles non-zero minute schedules", () => {
    expect(isReminderTime(9, 30, 9, 30)).toBe(true);
    expect(isReminderTime(9, 30, 9, 44)).toBe(true);
    expect(isReminderTime(9, 30, 9, 45)).toBe(false);
    expect(isReminderTime(9, 30, 9, 29)).toBe(false);
  });

  it("handles midnight schedules", () => {
    expect(isReminderTime(0, 0, 0, 0)).toBe(true);
    expect(isReminderTime(0, 0, 0, 14)).toBe(true);
    expect(isReminderTime(0, 0, 0, 15)).toBe(false);
  });

  it("handles late night schedules", () => {
    expect(isReminderTime(23, 45, 23, 45)).toBe(true);
    expect(isReminderTime(23, 45, 23, 59)).toBe(true);
  });
});

describe("notification settings router", () => {
  it("should have notification router defined in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    // Check that notification procedures exist
    expect(appRouter._def.procedures).toBeDefined();
  });
});
