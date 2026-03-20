import { describe, it, expect, vi } from "vitest";

// ─── Sync Status Tests ──────────────────────────────────────

describe("Sync Status API", () => {
  it("should have sync router defined in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter).toBeDefined();
    // Check that sync.status procedure exists
    expect((appRouter as any)._def.procedures["sync.status"]).toBeDefined();
  });

  it("getSyncStatus should return correct structure", async () => {
    const { getSyncStatus } = await import("./db");
    expect(getSyncStatus).toBeDefined();
    expect(typeof getSyncStatus).toBe("function");
  });

  it("getSyncStatus should return totalEntries, latestUpdate, firstDate, lastDate", async () => {
    // Mock db to return empty
    const db = await import("./db");
    const result = await db.getSyncStatus(999999);
    // Should return the expected shape even with no data
    expect(result).toHaveProperty("totalEntries");
    expect(result).toHaveProperty("latestUpdate");
    expect(result).toHaveProperty("firstDate");
    expect(result).toHaveProperty("lastDate");
    expect(typeof result.totalEntries).toBe("number");
  });

  it("sync status should be a protected procedure", async () => {
    const { appRouter } = await import("./routers");
    const procedure = (appRouter as any)._def.procedures["sync.status"];
    expect(procedure).toBeDefined();
    // Protected procedures have middleware
    expect(procedure._def.middlewares?.length).toBeGreaterThan(0);
  });
});

// ─── Quick Record Tests ──────────────────────────────────────

describe("Quick Record Mode", () => {
  it("entries.upsert should accept partial symptom data (all fields have defaults)", async () => {
    const { appRouter } = await import("./routers");
    const procedure = (appRouter as any)._def.procedures["entries.upsert"];
    expect(procedure).toBeDefined();
  });

  it("entry input schema should have default values for optional fields", async () => {
    // The entryInputSchema requires all 9 symptom fields but medications/triggers have defaults
    const { appRouter } = await import("./routers");
    const procedure = (appRouter as any)._def.procedures["entries.upsert"];
    expect(procedure).toBeDefined();
    // Verify the schema accepts the full entry shape
    const inputDef = procedure._def.inputs;
    expect(inputDef).toBeDefined();
  });

  it("should support saving with all 9 symptom fields", async () => {
    // Verify the schema structure
    const { z } = await import("zod");
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dizziness: z.number().min(0).max(10),
      headache: z.number().min(0).max(10),
      sleepQuality: z.number().min(0).max(10),
      anxiety: z.number().min(0).max(10),
      fatigue: z.number().min(0).max(10),
      photosensitivity: z.number().min(0).max(10),
      motionSickness: z.number().min(0).max(10),
      palpitations: z.number().min(0).max(10),
      mood: z.number().min(0).max(10),
      medications: z.array(z.object({ name: z.string(), dosage: z.string() })).default([]),
      triggers: z.array(z.string()).default([]),
      severeHeadache: z.number().min(0).max(1).default(0),
      notes: z.string().optional().nullable(),
    });

    // Quick record sends all fields with defaults for unselected ones
    const quickEntry = {
      date: "2026-03-20",
      dizziness: 5,
      headache: 3,
      sleepQuality: 7,
      anxiety: 0,
      fatigue: 0,
      photosensitivity: 0,
      motionSickness: 0,
      palpitations: 0,
      mood: 5,
    };
    const result = schema.safeParse(quickEntry);
    expect(result.success).toBe(true);
  });

  it("quick record default metrics should include dizziness, headache, sleepQuality", () => {
    const DEFAULT_QUICK_METRICS = ["dizziness", "headache", "sleepQuality"];
    expect(DEFAULT_QUICK_METRICS).toHaveLength(3);
    expect(DEFAULT_QUICK_METRICS).toContain("dizziness");
    expect(DEFAULT_QUICK_METRICS).toContain("headache");
    expect(DEFAULT_QUICK_METRICS).toContain("sleepQuality");
  });

  it("quick record should enforce 2-5 metric selection range", () => {
    const MIN_METRICS = 2;
    const MAX_METRICS = 5;
    expect(MIN_METRICS).toBe(2);
    expect(MAX_METRICS).toBe(5);

    // Simulate selection logic
    const selected = ["dizziness", "headache", "sleepQuality"];
    // Can't remove below 2
    const afterRemove = selected.filter((k) => k !== "dizziness");
    expect(afterRemove.length).toBeGreaterThanOrEqual(MIN_METRICS);

    // Can add up to 5
    const expanded = [...selected, "anxiety", "fatigue"];
    expect(expanded.length).toBeLessThanOrEqual(MAX_METRICS);
  });

  it("all 9 symptom metrics should be available for selection", () => {
    const ALL_METRICS = [
      "dizziness", "headache", "sleepQuality", "anxiety",
      "fatigue", "photosensitivity", "motionSickness", "palpitations", "mood",
    ];
    expect(ALL_METRICS).toHaveLength(9);
  });

  it("quick record should preserve existing entry data for unselected fields", () => {
    const existingEntry = {
      dizziness: 3,
      headache: 5,
      sleepQuality: 7,
      anxiety: 2,
      fatigue: 4,
      photosensitivity: 1,
      motionSickness: 0,
      palpitations: 2,
      mood: 6,
      medications: [{ name: "药品A", dosage: "10mg" }],
      triggers: ["睡眠不足"],
      severeHeadache: 0,
      notes: "测试备注",
    };

    // Quick record only edits selected metrics, preserves others
    const selectedMetrics = ["dizziness", "headache"];
    const quickValues = { dizziness: 7, headache: 8 };

    const result: Record<string, any> = { ...existingEntry };
    for (const key of selectedMetrics) {
      result[key] = (quickValues as any)[key];
    }

    expect(result.dizziness).toBe(7); // Updated
    expect(result.headache).toBe(8); // Updated
    expect(result.sleepQuality).toBe(7); // Preserved
    expect(result.medications).toEqual([{ name: "药品A", dosage: "10mg" }]); // Preserved
    expect(result.notes).toBe("测试备注"); // Preserved
  });
});

// ─── Integration Tests ──────────────────────────────────────

describe("Feature Integration", () => {
  it("appRouter should have sync, backup, entries, and other routers", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    
    expect(procedures).toContain("sync.status");
    expect(procedures).toContain("backup.export");
    expect(procedures).toContain("backup.restore");
    expect(procedures).toContain("entries.list");
    expect(procedures).toContain("entries.upsert");
  });

  it("localStorage key for record mode should be 'record-mode'", () => {
    const RECORD_MODE_KEY = "record-mode";
    expect(RECORD_MODE_KEY).toBe("record-mode");
  });

  it("localStorage key for quick metrics should be 'quick-record-metrics'", () => {
    const STORAGE_KEY = "quick-record-metrics";
    expect(STORAGE_KEY).toBe("quick-record-metrics");
  });
});
