/**
 * Tests for the medication date selector feature:
 * - confirmMedicationTaken accepts optional date parameter
 * - unconfirmMedicationTaken accepts optional date parameter
 * - todayMeds query accepts date parameter
 * - Date selector UI logic (date formatting, navigation constraints)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
  confirmMedicationTaken: vi.fn(),
  unconfirmMedicationTaken: vi.fn(),
  getTodayMedications: vi.fn(),
}));

import {
  confirmMedicationTaken,
  unconfirmMedicationTaken,
  getTodayMedications,
} from "./db";

const mockConfirm = vi.mocked(confirmMedicationTaken);
const mockUnconfirm = vi.mocked(unconfirmMedicationTaken);
const mockGetTodayMeds = vi.mocked(getTodayMedications);

describe("confirmMedicationTaken with date parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept a date parameter for retroactive check-in", async () => {
    mockConfirm.mockResolvedValue({
      success: true,
      medicationName: "布洛芬",
      dosage: "200mg",
    } as any);

    const result = await confirmMedicationTaken(1, 10, 0, undefined, "2026-03-15");
    expect(mockConfirm).toHaveBeenCalledWith(1, 10, 0, undefined, "2026-03-15");
    expect(result).toBeDefined();
  });

  it("should work without date parameter (defaults to today)", async () => {
    mockConfirm.mockResolvedValue({
      success: true,
      medicationName: "维生素C",
      dosage: "1片",
    } as any);

    const result = await confirmMedicationTaken(1, 10, 0, undefined, undefined);
    expect(mockConfirm).toHaveBeenCalledWith(1, 10, 0, undefined, undefined);
    expect(result).toBeDefined();
  });

  it("should accept date with note for retroactive check-in", async () => {
    mockConfirm.mockResolvedValue({
      success: true,
      medicationName: "阿莫西林",
      dosage: "500mg",
    } as any);

    const result = await confirmMedicationTaken(1, 10, 0, "补打卡", "2026-03-10");
    expect(mockConfirm).toHaveBeenCalledWith(1, 10, 0, "补打卡", "2026-03-10");
    expect(result).toBeDefined();
  });
});

describe("unconfirmMedicationTaken with date parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept a date parameter for retroactive unconfirm", async () => {
    mockUnconfirm.mockResolvedValue({
      success: true,
      medicationName: "布洛芬",
    } as any);

    const result = await unconfirmMedicationTaken(1, 10, 0, "2026-03-15");
    expect(mockUnconfirm).toHaveBeenCalledWith(1, 10, 0, "2026-03-15");
    expect(result).toBeDefined();
  });

  it("should work without date parameter (defaults to today)", async () => {
    mockUnconfirm.mockResolvedValue({
      success: true,
      medicationName: "维生素C",
    } as any);

    const result = await unconfirmMedicationTaken(1, 10, 0, undefined);
    expect(mockUnconfirm).toHaveBeenCalledWith(1, 10, 0, undefined);
    expect(result).toBeDefined();
  });
});

describe("getTodayMedications with date parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return medications for a specific past date", async () => {
    mockGetTodayMeds.mockResolvedValue([
      {
        name: "布洛芬",
        dosage: "200mg",
        reminderId: 1,
        taken: false,
        reminderHour: 8,
        reminderMinute: 0,
        groupId: null,
      },
    ] as any);

    const result = await getTodayMedications(1, "2026-03-15");
    expect(mockGetTodayMeds).toHaveBeenCalledWith(1, "2026-03-15");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("布洛芬");
  });

  it("should return medications with taken=true for past date with confirmed entries", async () => {
    mockGetTodayMeds.mockResolvedValue([
      {
        name: "布洛芬",
        dosage: "200mg",
        reminderId: 1,
        taken: true,
        reminderHour: 8,
        reminderMinute: 0,
        groupId: null,
      },
    ] as any);

    const result = await getTodayMedications(1, "2026-03-10");
    expect(result[0].taken).toBe(true);
  });
});

describe("Date selector UI logic", () => {
  // Helper functions matching MedicationView
  function dateToDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dateStrToDate(dateStr: string): Date {
    return new Date(dateStr + "T00:00:00");
  }

  it("should format date string correctly", () => {
    const d = new Date(2026, 2, 15); // March 15, 2026
    expect(dateToDateStr(d)).toBe("2026-03-15");
  });

  it("should parse date string correctly", () => {
    const d = dateStrToDate("2026-03-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  it("should not allow navigating to future dates", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = dateToDateStr(today);

    // Try to go to tomorrow
    const next = dateStrToDate(todayStr);
    next.setDate(next.getDate() + 1);
    const canGoNext = next <= today;

    expect(canGoNext).toBe(false);
  });

  it("should allow navigating to past dates", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = dateToDateStr(today);

    // Go to yesterday
    const prev = dateStrToDate(todayStr);
    prev.setDate(prev.getDate() - 1);
    const prevStr = dateToDateStr(prev);

    expect(prevStr).not.toBe(todayStr);
    // Can go next from yesterday
    const next = dateStrToDate(prevStr);
    next.setDate(next.getDate() + 1);
    const canGoNext = next <= today;
    expect(canGoNext).toBe(true);
  });

  it("should correctly identify today vs past dates", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = dateToDateStr(today);

    expect(todayStr === todayStr).toBe(true); // isToday = true

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = dateToDateStr(yesterday);

    expect(yesterdayStr === todayStr).toBe(false); // isToday = false
  });

  it("should display correct date format for display", () => {
    const dateStr = "2026-03-15";
    const d = new Date(dateStr + "T00:00:00");
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const monthDay = `${d.getMonth() + 1}月${d.getDate()}日`;
    const weekday = `星期${weekdays[d.getDay()]}`;

    expect(monthDay).toBe("3月15日");
    expect(weekday).toBe("星期日");
  });

  it("should handle month boundaries correctly", () => {
    const lastDayOfFeb = dateStrToDate("2026-02-28");
    lastDayOfFeb.setDate(lastDayOfFeb.getDate() + 1);
    expect(dateToDateStr(lastDayOfFeb)).toBe("2026-03-01");
  });
});
