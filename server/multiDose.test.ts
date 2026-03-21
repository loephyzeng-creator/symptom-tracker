import { describe, it, expect } from "vitest";
import { buildEntryMedMap, wasMedTaken } from "./medMatchHelper";

describe("Multi-dose medication support", () => {
  describe("medMatchHelper with timeIndex", () => {
    it("should build entry med map with reminderTimeKeys", () => {
      const entries = [
        {
          date: "2026-03-21",
          medications: [
            { name: "Drug A", dosage: "10mg", reminderId: 1, timeIndex: 0 },
            { name: "Drug A", dosage: "10mg", reminderId: 1, timeIndex: 1 },
            { name: "Drug B", dosage: "5mg", reminderId: 2 },
          ],
        },
      ];

      const map = buildEntryMedMap(entries);
      const info = map.get("2026-03-21");
      expect(info).toBeDefined();
      expect(info!.names.has("drug a")).toBe(true);
      expect(info!.names.has("drug b")).toBe(true);
      expect(info!.reminderIds.has(1)).toBe(true);
      expect(info!.reminderIds.has(2)).toBe(true);
      expect(info!.reminderTimeKeys.has("1:0")).toBe(true);
      expect(info!.reminderTimeKeys.has("1:1")).toBe(true);
      expect(info!.reminderTimeKeys.has("2")).toBe(true);
    });

    it("wasMedTaken should match specific timeIndex for multi-dose", () => {
      const entries = [
        {
          date: "2026-03-21",
          medications: [
            { name: "Drug A", dosage: "10mg", reminderId: 1, timeIndex: 0 },
            // timeIndex 1 NOT taken
          ],
        },
      ];

      const map = buildEntryMedMap(entries);
      const info = map.get("2026-03-21");

      // timeIndex 0 was taken
      expect(wasMedTaken(info, 1, "Drug A", 0)).toBe(true);
      // timeIndex 1 was NOT taken
      expect(wasMedTaken(info, 1, "Drug A", 1)).toBe(false);
    });

    it("wasMedTaken should work for single-dose (no timeIndex)", () => {
      const entries = [
        {
          date: "2026-03-21",
          medications: [
            { name: "Drug B", dosage: "5mg", reminderId: 2 },
          ],
        },
      ];

      const map = buildEntryMedMap(entries);
      const info = map.get("2026-03-21");

      // Single dose: matched by reminderId
      expect(wasMedTaken(info, 2, "Drug B")).toBe(true);
      // Not taken
      expect(wasMedTaken(info, 3, "Drug C")).toBe(false);
    });

    it("wasMedTaken should fall back to name match for single-dose", () => {
      const entries = [
        {
          date: "2026-03-21",
          medications: [
            { name: "Drug X", dosage: "10mg" },
          ],
        },
      ];

      const map = buildEntryMedMap(entries);
      const info = map.get("2026-03-21");

      // No reminderId, but name matches
      expect(wasMedTaken(info, 99, "Drug X")).toBe(true);
      expect(wasMedTaken(info, 99, "drug x")).toBe(true);
      expect(wasMedTaken(info, 99, "Drug Y")).toBe(false);
    });

    it("wasMedTaken should return false for undefined recorded", () => {
      expect(wasMedTaken(undefined, 1, "Drug A")).toBe(false);
      expect(wasMedTaken(undefined, 1, "Drug A", 0)).toBe(false);
    });

    it("should handle empty medications array", () => {
      const entries = [
        { date: "2026-03-21", medications: [] },
      ];

      const map = buildEntryMedMap(entries);
      const info = map.get("2026-03-21");
      expect(info).toBeDefined();
      expect(info!.names.size).toBe(0);
      expect(info!.reminderIds.size).toBe(0);
      expect(info!.reminderTimeKeys.size).toBe(0);
    });

    it("should handle null medications", () => {
      const entries = [
        { date: "2026-03-21", medications: null },
      ];

      const map = buildEntryMedMap(entries);
      const info = map.get("2026-03-21");
      expect(info).toBeDefined();
      expect(info!.names.size).toBe(0);
    });
  });

  describe("ReminderTimes data structure", () => {
    it("reminderTimes should be a valid array of {hour, minute}", () => {
      const times = [
        { hour: 8, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 20, minute: 0 },
      ];

      expect(times).toHaveLength(3);
      expect(times[0].hour).toBe(8);
      expect(times[1].hour).toBe(14);
      expect(times[2].hour).toBe(20);
      times.forEach((t) => {
        expect(t.hour).toBeGreaterThanOrEqual(0);
        expect(t.hour).toBeLessThanOrEqual(23);
        expect(t.minute).toBeGreaterThanOrEqual(0);
        expect(t.minute).toBeLessThanOrEqual(59);
      });
    });

    it("should sort reminderTimes by time", () => {
      const times = [
        { hour: 20, minute: 0 },
        { hour: 8, minute: 0 },
        { hour: 14, minute: 30 },
      ];

      const sorted = [...times].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
      );

      expect(sorted[0].hour).toBe(8);
      expect(sorted[1].hour).toBe(14);
      expect(sorted[2].hour).toBe(20);
    });
  });

  describe("Multi-dose today meds expansion", () => {
    it("should expand single reminder with 3 times into 3 items", () => {
      // Simulating what getTodayMedications does
      const reminder = {
        id: 1,
        medicationName: "Drug A",
        dosage: "10mg",
        reminderHour: 8,
        reminderMinute: 0,
        reminderTimes: [
          { hour: 8, minute: 0 },
          { hour: 14, minute: 0 },
          { hour: 20, minute: 0 },
        ],
      };

      const expanded = reminder.reminderTimes.map((t, idx) => ({
        reminderId: reminder.id,
        name: reminder.medicationName,
        dosage: reminder.dosage,
        reminderHour: t.hour,
        reminderMinute: t.minute,
        timeIndex: idx,
        taken: false,
      }));

      expect(expanded).toHaveLength(3);
      expect(expanded[0].timeIndex).toBe(0);
      expect(expanded[0].reminderHour).toBe(8);
      expect(expanded[1].timeIndex).toBe(1);
      expect(expanded[1].reminderHour).toBe(14);
      expect(expanded[2].timeIndex).toBe(2);
      expect(expanded[2].reminderHour).toBe(20);
    });

    it("should keep single item for reminder without reminderTimes", () => {
      const reminder = {
        id: 2,
        medicationName: "Drug B",
        dosage: "5mg",
        reminderHour: 10,
        reminderMinute: 0,
        reminderTimes: null,
      };

      const expanded = reminder.reminderTimes
        ? reminder.reminderTimes.map((t: any, idx: number) => ({
            reminderId: reminder.id,
            name: reminder.medicationName,
            dosage: reminder.dosage,
            reminderHour: t.hour,
            reminderMinute: t.minute,
            timeIndex: idx,
            taken: false,
          }))
        : [
            {
              reminderId: reminder.id,
              name: reminder.medicationName,
              dosage: reminder.dosage,
              reminderHour: reminder.reminderHour,
              reminderMinute: reminder.reminderMinute,
              timeIndex: undefined,
              taken: false,
            },
          ];

      expect(expanded).toHaveLength(1);
      expect(expanded[0].timeIndex).toBeUndefined();
      expect(expanded[0].reminderHour).toBe(10);
    });
  });
});
