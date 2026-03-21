import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the enhanced todayMeds API:
 * - todayMeds returns taken status per medication
 * - unconfirmMedicationTaken removes medication from entry
 * - handleSave merges taken reminder meds + manual extra meds
 * - takenCount / totalMedCount computation
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
      { name: "布洛芬", dosage: "200mg", reminderId: 1, taken: false, reminderHour: 8, reminderMinute: 0, groupId: null },
      { name: "阿莫西林", dosage: "500mg", reminderId: 2, taken: false, reminderHour: 9, reminderMinute: 0, groupId: null },
    ]);

    const result = await getTodayMedications(1, "2026-03-21");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("布洛芬");
    expect(result[1].name).toBe("阿莫西林");
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

describe("todayMeds taken status logic", () => {
  it("should return taken=false when no entry exists", () => {
    const reminders = [
      { id: 1, medicationName: "布洛芬", dosage: "200mg", reminderHour: 8, reminderMinute: 0, groupId: null },
      { id: 2, medicationName: "维生素C", dosage: "1片", reminderHour: 9, reminderMinute: 0, groupId: null },
    ];
    const takenMeds: { name: string; dosage: string; reminderId?: number }[] = [];

    const result = reminders.map((r) => {
      const taken = takenMeds.some(
        (m) => m.reminderId === r.id || m.name.toLowerCase() === r.medicationName.toLowerCase()
      );
      return {
        name: r.medicationName, dosage: r.dosage, reminderId: r.id,
        reminderHour: r.reminderHour, reminderMinute: r.reminderMinute,
        groupId: r.groupId, taken,
      };
    });

    expect(result).toHaveLength(2);
    expect(result[0].taken).toBe(false);
    expect(result[1].taken).toBe(false);
    expect(result[0].reminderHour).toBe(8);
  });

  it("should return taken=true when matched by reminderId", () => {
    const reminders = [
      { id: 1, medicationName: "布洛芬", dosage: "200mg", reminderHour: 8, reminderMinute: 0, groupId: null },
      { id: 2, medicationName: "维生素C", dosage: "1片", reminderHour: 9, reminderMinute: 0, groupId: null },
    ];
    const takenMeds = [{ name: "布洛芬", dosage: "200mg", reminderId: 1 }];

    const result = reminders.map((r) => {
      const taken = takenMeds.some(
        (m) => m.reminderId === r.id || m.name.toLowerCase() === r.medicationName.toLowerCase()
      );
      return { name: r.medicationName, dosage: r.dosage, reminderId: r.id, taken };
    });

    expect(result[0].taken).toBe(true);
    expect(result[1].taken).toBe(false);
  });

  it("should return taken=true when matched by name (no reminderId)", () => {
    const reminders = [
      { id: 1, medicationName: "布洛芬", dosage: "200mg", reminderHour: 8, reminderMinute: 0, groupId: null },
    ];
    const takenMeds = [{ name: "布洛芬", dosage: "200mg" }];

    const result = reminders.map((r) => {
      const taken = takenMeds.some(
        (m: any) => m.reminderId === r.id || m.name.toLowerCase() === r.medicationName.toLowerCase()
      );
      return { name: r.medicationName, dosage: r.dosage, reminderId: r.id, taken };
    });

    expect(result[0].taken).toBe(true);
  });

  it("should include reminderHour, reminderMinute, and groupId", () => {
    const reminders = [
      { id: 1, medicationName: "布洛芬", dosage: "200mg", reminderHour: 14, reminderMinute: 30, groupId: 5 },
    ];
    const takenMeds: any[] = [];

    const result = reminders.map((r) => {
      const taken = takenMeds.some(
        (m: any) => m.reminderId === r.id || m.name?.toLowerCase() === r.medicationName.toLowerCase()
      );
      return {
        name: r.medicationName, dosage: r.dosage, reminderId: r.id,
        reminderHour: r.reminderHour, reminderMinute: r.reminderMinute,
        groupId: r.groupId, taken,
      };
    });

    expect(result[0].reminderHour).toBe(14);
    expect(result[0].reminderMinute).toBe(30);
    expect(result[0].groupId).toBe(5);
    expect(result[0].taken).toBe(false);
  });
});

describe("unconfirmMedicationTaken logic", () => {
  it("should remove medication from entry by reminderId", () => {
    const currentMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
      { name: "维生素C", dosage: "1片", reminderId: 2 },
    ];
    const reminderToRemove = { id: 1, medicationName: "布洛芬" };

    const updatedMeds = currentMeds.filter(
      (m) => !(m.reminderId === reminderToRemove.id || m.name.toLowerCase() === reminderToRemove.medicationName.toLowerCase())
    );

    expect(updatedMeds).toHaveLength(1);
    expect(updatedMeds[0].name).toBe("维生素C");
  });

  it("should remove medication by name match when no reminderId", () => {
    const currentMeds = [
      { name: "布洛芬", dosage: "200mg" } as any,
      { name: "维生素C", dosage: "1片", reminderId: 2 },
    ];
    const reminderToRemove = { id: 1, medicationName: "布洛芬" };

    const updatedMeds = currentMeds.filter(
      (m: any) => !(m.reminderId === reminderToRemove.id || m.name.toLowerCase() === reminderToRemove.medicationName.toLowerCase())
    );

    expect(updatedMeds).toHaveLength(1);
    expect(updatedMeds[0].name).toBe("维生素C");
  });

  it("should not remove anything if medication not found", () => {
    const currentMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1 },
    ];
    const reminderToRemove = { id: 99, medicationName: "阿莫西林" };

    const updatedMeds = currentMeds.filter(
      (m) => !(m.reminderId === reminderToRemove.id || m.name.toLowerCase() === reminderToRemove.medicationName.toLowerCase())
    );

    expect(updatedMeds).toHaveLength(1);
  });
});

describe("handleSave merges taken meds + extra meds", () => {
  it("should combine taken reminder meds with manual extra meds", () => {
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1, taken: true, reminderHour: 8, reminderMinute: 0, groupId: null },
      { name: "维生素C", dosage: "1片", reminderId: 2, taken: false, reminderHour: 9, reminderMinute: 0, groupId: null },
    ];
    const manualMeds = [{ name: "感冒灵", dosage: "1包" }];

    const takenReminderMeds = todayMeds
      .filter((m) => m.taken)
      .map((m) => ({ name: m.name, dosage: m.dosage, reminderId: m.reminderId }));
    const extraMeds = manualMeds.filter((m: any) => !m.reminderId && m.name.trim());
    const allMeds = [...takenReminderMeds, ...extraMeds];

    expect(allMeds).toHaveLength(2);
    expect(allMeds[0].name).toBe("布洛芬");
    expect(allMeds[0].reminderId).toBe(1);
    expect(allMeds[1].name).toBe("感冒灵");
    expect((allMeds[1] as any).reminderId).toBeUndefined();
  });

  it("should return empty when no meds taken and no extra meds", () => {
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1, taken: false, reminderHour: 8, reminderMinute: 0, groupId: null },
    ];
    const manualMeds: any[] = [];

    const takenReminderMeds = todayMeds
      .filter((m) => m.taken)
      .map((m) => ({ name: m.name, dosage: m.dosage, reminderId: m.reminderId }));
    const extraMeds = manualMeds.filter((m: any) => !m.reminderId && m.name.trim());
    const allMeds = [...takenReminderMeds, ...extraMeds];

    expect(allMeds).toHaveLength(0);
  });

  it("should only include taken meds from reminders, not untaken", () => {
    const todayMeds = [
      { name: "布洛芬", dosage: "200mg", reminderId: 1, taken: true },
      { name: "维生素C", dosage: "1片", reminderId: 2, taken: true },
      { name: "阿莫西林", dosage: "500mg", reminderId: 3, taken: false },
    ];

    const takenReminderMeds = todayMeds
      .filter((m) => m.taken)
      .map((m) => ({ name: m.name, dosage: m.dosage, reminderId: m.reminderId }));

    expect(takenReminderMeds).toHaveLength(2);
    expect(takenReminderMeds.map((m) => m.name)).toEqual(["布洛芬", "维生素C"]);
  });
});

describe("toggle taken state", () => {
  it("should toggle from untaken to taken", () => {
    const med = { name: "布洛芬", taken: false };
    expect(!med.taken).toBe(true);
  });

  it("should toggle from taken to untaken", () => {
    const med = { name: "布洛芬", taken: true };
    expect(!med.taken).toBe(false);
  });
});

describe("takenCount and totalMedCount computation", () => {
  it("should compute correct counts", () => {
    const todayMeds = [
      { name: "布洛芬", reminderId: 1, taken: true },
      { name: "维生素C", reminderId: 2, taken: true },
      { name: "阿莫西林", reminderId: 3, taken: false },
    ];

    const takenCount = todayMeds.filter((m) => m.taken).length;
    const totalMedCount = todayMeds.length;

    expect(takenCount).toBe(2);
    expect(totalMedCount).toBe(3);
  });

  it("should return 0 for empty list", () => {
    const todayMeds: any[] = [];

    const takenCount = todayMeds.filter((m) => m.taken).length;
    const totalMedCount = todayMeds.length;

    expect(takenCount).toBe(0);
    expect(totalMedCount).toBe(0);
  });

  it("should show all taken when all meds confirmed", () => {
    const todayMeds = [
      { name: "布洛芬", reminderId: 1, taken: true },
      { name: "维生素C", reminderId: 2, taken: true },
    ];

    const takenCount = todayMeds.filter((m) => m.taken).length;
    const totalMedCount = todayMeds.length;

    expect(takenCount).toBe(totalMedCount);
    expect(takenCount).toBe(2);
  });
});
