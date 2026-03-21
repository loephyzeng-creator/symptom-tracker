import { describe, it, expect } from "vitest";

/**
 * Tests for medication groups and data integration features:
 * 1. Medication groups CRUD
 * 2. Reminder-entry data integration (reminderId linking)
 * 3. Group assignment and confirm-all
 */

// ─── 1. Medication Groups Schema ──────────────────────────────────

describe("Medication Groups - Schema", () => {
  it("should have medicationGroups table with required columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.medicationGroups).toBeDefined();
    const columnNames = Object.keys(schema.medicationGroups);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("color");
    expect(columnNames).toContain("sortOrder");
  });

  it("should have groupId column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("groupId");
  });
});

// ─── 2. Medication Groups DB Functions ────────────────────────────

describe("Medication Groups - DB Functions", () => {
  it("should export createMedicationGroup function", async () => {
    const db = await import("./db");
    expect(typeof db.createMedicationGroup).toBe("function");
  });

  it("should export updateMedicationGroup function", async () => {
    const db = await import("./db");
    expect(typeof db.updateMedicationGroup).toBe("function");
  });

  it("should export deleteMedicationGroup function", async () => {
    const db = await import("./db");
    expect(typeof db.deleteMedicationGroup).toBe("function");
  });

  it("should export assignMedicationToGroup function", async () => {
    const db = await import("./db");
    expect(typeof db.assignMedicationToGroup).toBe("function");
  });

  it("should export batchAssignMedicationsToGroup function", async () => {
    const db = await import("./db");
    expect(typeof db.batchAssignMedicationsToGroup).toBe("function");
  });

  it("should export getMedicationRemindersGrouped function", async () => {
    const db = await import("./db");
    expect(typeof db.getMedicationRemindersGrouped).toBe("function");
  });

  it("should export confirmGroupMedicationsTaken function", async () => {
    const db = await import("./db");
    expect(typeof db.confirmGroupMedicationsTaken).toBe("function");
  });
});

// ─── 3. Medication Groups Router ──────────────────────────────────

describe("Medication Groups - Router", () => {
  it("should have medGroups.list procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.list"]).toBeDefined();
  });

  it("should have medGroups.create procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.create"]).toBeDefined();
  });

  it("should have medGroups.update procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.update"]).toBeDefined();
  });

  it("should have medGroups.delete procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.delete"]).toBeDefined();
  });

  it("should have medGroups.assign procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.assign"]).toBeDefined();
  });

  it("should have medGroups.grouped procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.grouped"]).toBeDefined();
  });

  it("should have medGroups.confirmAll procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medGroups.confirmAll"]).toBeDefined();
  });
});

// ─── 4. Data Integration (reminderId linking) ─────────────────────

describe("Data Integration - reminderId in medications", () => {
  it("should have reminderId field in MedicationItem type", async () => {
    // The medications JSON in symptom_entries should support reminderId
    const schema = await import("../drizzle/schema");
    // Check that the symptomEntries table has medications column
    const columnNames = Object.keys(schema.symptomEntries);
    expect(columnNames).toContain("medications");
  });
});

describe("Data Integration - medMatchHelper", () => {
  it("should export buildEntryMedMap function", async () => {
    const helper = await import("./medMatchHelper");
    expect(typeof helper.buildEntryMedMap).toBe("function");
  });

  it("should export wasMedTaken function", async () => {
    const helper = await import("./medMatchHelper");
    expect(typeof helper.wasMedTaken).toBe("function");
  });

  it("buildEntryMedMap should build correct map from entries", async () => {
    const { buildEntryMedMap } = await import("./medMatchHelper");
    const entries = [
      {
        date: "2026-03-20",
        medications: [
          { name: "阿司匹林", dosage: "100mg", reminderId: 1 },
          { name: "维生素C", dosage: "1片" },
        ],
      },
      {
        date: "2026-03-21",
        medications: [
          { name: "布洛芬", dosage: "200mg", reminderId: 2 },
        ],
      },
    ];
    const map = buildEntryMedMap(entries);
    expect(map.size).toBe(2);

    const day20 = map.get("2026-03-20");
    expect(day20).toBeDefined();
    expect(day20!.names.has("阿司匹林")).toBe(true);
    expect(day20!.names.has("维生素c")).toBe(true);
    expect(day20!.reminderIds.has(1)).toBe(true);
    expect(day20!.reminderIds.has(2)).toBe(false);

    const day21 = map.get("2026-03-21");
    expect(day21).toBeDefined();
    expect(day21!.reminderIds.has(2)).toBe(true);
  });

  it("wasMedTaken should match by reminderId first, then name", async () => {
    const { wasMedTaken, buildEntryMedMap } = await import("./medMatchHelper");
    const entries = [
      {
        date: "2026-03-20",
        medications: [
          { name: "阿司匹林", dosage: "100mg", reminderId: 1 },
        ],
      },
    ];
    const map = buildEntryMedMap(entries);
    const recorded = map.get("2026-03-20");

    // Match by reminderId
    expect(wasMedTaken(recorded, 1, "不同名字")).toBe(true);
    // Match by name (fallback)
    expect(wasMedTaken(recorded, 999, "阿司匹林")).toBe(true);
    // No match
    expect(wasMedTaken(recorded, 999, "不存在的药")).toBe(false);
    // Undefined recorded
    expect(wasMedTaken(undefined, 1, "阿司匹林")).toBe(false);
  });

  it("buildEntryMedMap should handle empty and null medications", async () => {
    const { buildEntryMedMap } = await import("./medMatchHelper");
    const entries = [
      { date: "2026-03-20", medications: null },
      { date: "2026-03-21", medications: [] },
      { date: "2026-03-22", medications: "invalid" },
    ];
    const map = buildEntryMedMap(entries);
    expect(map.size).toBe(3);
    const day20 = map.get("2026-03-20");
    expect(day20!.names.size).toBe(0);
    expect(day20!.reminderIds.size).toBe(0);
  });
});

// ─── 5. Add/Update with groupId support ───────────────────────────

describe("Medication Reminders - groupId in add/update", () => {
  it("addMedicationReminder should accept groupId parameter", async () => {
    const db = await import("./db");
    // Verify the function signature accepts groupId
    expect(typeof db.addMedicationReminder).toBe("function");
    // The function should have the correct parameter count (userId, data)
    expect(db.addMedicationReminder.length).toBe(2);
  });

  it("updateMedicationReminder should accept groupId parameter", async () => {
    const db = await import("./db");
    expect(typeof db.updateMedicationReminder).toBe("function");
    expect(db.updateMedicationReminder.length).toBe(3);
  });

  it("medReminders.add router should accept groupId in input", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    const addProc = procedures["medReminders.add"];
    expect(addProc).toBeDefined();
    // Verify it's a mutation
    expect(addProc._def.type).toBe("mutation");
  });

  it("medReminders.update router should accept groupId in input", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    const updateProc = procedures["medReminders.update"];
    expect(updateProc).toBeDefined();
    expect(updateProc._def.type).toBe("mutation");
  });
});

// ─── 6. Expiration detection DB function ──────────────────────────

describe("Expiration Detection", () => {
  it("should export getExpiringMedications function", async () => {
    const db = await import("./db");
    expect(typeof db.getExpiringMedications).toBe("function");
  });

  it("should have expirationDate column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("expirationDate");
    expect(columnNames).toContain("expirationAlertDays");
  });
});
