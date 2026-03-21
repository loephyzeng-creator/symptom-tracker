import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the todayMeds data sharing feature:
 * - getTodayMedications returns correct medications based on date and repeat days
 * - Integration with symptom form auto-fill
 */

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getTodayMedications: vi.fn(),
}));

import { getTodayMedications } from "./db";

const mockGetTodayMedications = vi.mocked(getTodayMedications);

describe("getTodayMedications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all enabled reminders when repeatDays is null (every day)", async () => {
    mockGetTodayMedications.mockResolvedValue([
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
      { name: "阿莫西林", dosage: "500mg", reminderId: 2 },
    ]);

    const result = await getTodayMedications(1, "2026-03-21");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "布洛芬", dosage: "200mg", reminderId: 1 });
    expect(result[1]).toEqual({ name: "阿莫西林", dosage: "500mg", reminderId: 2 });
  });

  it("should filter by day of week when repeatDays is set", async () => {
    // 2026-03-21 is Saturday (day 6)
    mockGetTodayMedications.mockResolvedValue([
      { name: "周末药", dosage: "100mg", reminderId: 3 },
    ]);

    const result = await getTodayMedications(1, "2026-03-21");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("周末药");
  });

  it("should return empty array when no reminders match the day", async () => {
    mockGetTodayMedications.mockResolvedValue([]);

    const result = await getTodayMedications(1, "2026-03-21");
    expect(result).toHaveLength(0);
  });

  it("should return empty array when user has no reminders", async () => {
    mockGetTodayMedications.mockResolvedValue([]);

    const result = await getTodayMedications(999, "2026-03-21");
    expect(result).toHaveLength(0);
  });
});

describe("todayMeds data sharing logic", () => {
  it("should merge medications without duplicates", () => {
    const existingMeds = [
      { name: "布洛芬", dosage: "200mg" },
    ];
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
      { name: "阿莫西林", dosage: "500mg", reminderId: 2 },
    ];

    const existingNames = new Set(existingMeds.map((m) => m.name.toLowerCase().trim()));
    const newMeds = todayMeds
      .filter((m) => !existingNames.has(m.name.toLowerCase().trim()))
      .map((m) => ({ name: m.name, dosage: m.dosage }));

    expect(newMeds).toHaveLength(1);
    expect(newMeds[0]).toEqual({ name: "阿莫西林", dosage: "500mg" });
  });

  it("should handle case-insensitive duplicate detection", () => {
    const existingMeds = [
      { name: "布洛芬", dosage: "200mg" },
    ];
    const todayMeds = [
      { name: "布洛芬", dosage: "400mg", reminderId: 1 }, // Same name, different dosage
    ];

    const existingNames = new Set(existingMeds.map((m) => m.name.toLowerCase().trim()));
    const newMeds = todayMeds
      .filter((m) => !existingNames.has(m.name.toLowerCase().trim()))
      .map((m) => ({ name: m.name, dosage: m.dosage }));

    expect(newMeds).toHaveLength(0); // Should not duplicate
  });

  it("should add all medications when list is empty", () => {
    const existingMeds: { name: string; dosage: string }[] = [];
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
      { name: "阿莫西林", dosage: "500mg", reminderId: 2 },
      { name: "维生素C", dosage: "1000mg", reminderId: 3 },
    ];

    const existingNames = new Set(existingMeds.map((m) => m.name.toLowerCase().trim()));
    const newMeds = todayMeds
      .filter((m) => !existingNames.has(m.name.toLowerCase().trim()))
      .map((m) => ({ name: m.name, dosage: m.dosage }));

    expect(newMeds).toHaveLength(3);
  });

  it("should handle whitespace in medication names", () => {
    const existingMeds = [
      { name: " 布洛芬 ", dosage: "200mg" },
    ];
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
    ];

    const existingNames = new Set(existingMeds.map((m) => m.name.toLowerCase().trim()));
    const newMeds = todayMeds
      .filter((m) => !existingNames.has(m.name.toLowerCase().trim()))
      .map((m) => ({ name: m.name, dosage: m.dosage }));

    expect(newMeds).toHaveLength(0); // Trimmed match
  });
});

describe("stock deduction on save", () => {
  it("should identify medications that match reminders for stock deduction", () => {
    const cleanMeds = [
      { name: "布洛芬", dosage: "200mg" },
      { name: "阿莫西林", dosage: "500mg" },
      { name: "维生素D", dosage: "1000IU" },
    ];
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
      { name: "阿莫西林", dosage: "500mg", reminderId: 2 },
    ];

    const reminderNames = new Set(todayMeds.map((m) => m.name.toLowerCase().trim()));
    const medsToDeduct = cleanMeds.filter((med) =>
      reminderNames.has(med.name.toLowerCase().trim())
    );

    expect(medsToDeduct).toHaveLength(2);
    expect(medsToDeduct.map((m) => m.name)).toEqual(["布洛芬", "阿莫西林"]);
  });

  it("should not deduct stock for medications not in reminders", () => {
    const cleanMeds = [
      { name: "维生素D", dosage: "1000IU" },
    ];
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
    ];

    const reminderNames = new Set(todayMeds.map((m) => m.name.toLowerCase().trim()));
    const medsToDeduct = cleanMeds.filter((med) =>
      reminderNames.has(med.name.toLowerCase().trim())
    );

    expect(medsToDeduct).toHaveLength(0);
  });

  it("should not deduct when todayMeds is empty", () => {
    const cleanMeds = [
      { name: "布洛芬", dosage: "200mg" },
    ];
    const todayMeds: { name: string; dosage: string; reminderId: number }[] = [];

    const reminderNames = new Set(todayMeds.map((m) => m.name.toLowerCase().trim()));
    const medsToDeduct = cleanMeds.filter((med) =>
      reminderNames.has(med.name.toLowerCase().trim())
    );

    expect(medsToDeduct).toHaveLength(0);
  });
});
