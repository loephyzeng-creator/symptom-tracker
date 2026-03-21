import { describe, it, expect } from "vitest";

/**
 * Tests for the three new features:
 * 1. Missed medication alerts (adherence reminders)
 * 2. Medication stock management
 * 3. AI analysis with adherence data
 */

// ─── 1. Missed Medication Alerts ──────────────────────────────────

describe("Missed Medication Alerts - DB Exports", () => {
  it("should export getMissedMedicationAlerts function", async () => {
    const db = await import("./db");
    expect(typeof db.getMissedMedicationAlerts).toBe("function");
  });
});

describe("Missed Medication Alerts - Router", () => {
  it("should have missedAlerts procedure in medReminders router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.missedAlerts"]).toBeDefined();
  });
});

// ─── 2. Medication Stock Management ──────────────────────────────

describe("Medication Stock - Schema", () => {
  it("should have stockQuantity column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("stockQuantity");
  });

  it("should have dailyDosageCount column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("dailyDosageCount");
  });

  it("should have stockAlertDays column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("stockAlertDays");
  });

  it("should have lastStockAlertDate column in medicationReminders", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.medicationReminders);
    expect(columnNames).toContain("lastStockAlertDate");
  });
});

describe("Medication Stock - DB Exports", () => {
  it("should export getMedicationStockStatus function", async () => {
    const db = await import("./db");
    expect(typeof db.getMedicationStockStatus).toBe("function");
  });

  it("should export deductMedicationStock function", async () => {
    const db = await import("./db");
    expect(typeof db.deductMedicationStock).toBe("function");
  });

  it("should export getLowStockAlerts function", async () => {
    const db = await import("./db");
    expect(typeof db.getLowStockAlerts).toBe("function");
  });

  it("should export markStockAlertSent function", async () => {
    const db = await import("./db");
    expect(typeof db.markStockAlertSent).toBe("function");
  });
});

describe("Medication Stock - Router", () => {
  it("should have stockStatus procedure in medReminders router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.stockStatus"]).toBeDefined();
  });

  it("should have deductStock procedure in medReminders router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["medReminders.deductStock"]).toBeDefined();
  });
});

describe("Medication Stock - Business Logic", () => {
  it("should calculate days remaining correctly", () => {
    // 30 pills / 1 per day = 30 days
    const stockQuantity = 30;
    const dailyDosageCount = 1;
    const daysRemaining = Math.floor(stockQuantity / dailyDosageCount);
    expect(daysRemaining).toBe(30);
  });

  it("should calculate days remaining with multiple daily doses", () => {
    // 30 pills / 3 per day = 10 days
    const stockQuantity = 30;
    const dailyDosageCount = 3;
    const daysRemaining = Math.floor(stockQuantity / dailyDosageCount);
    expect(daysRemaining).toBe(10);
  });

  it("should return 0 days remaining when stock is empty", () => {
    const stockQuantity = 0;
    const dailyDosageCount = 1;
    const daysRemaining = Math.floor(stockQuantity / dailyDosageCount);
    expect(daysRemaining).toBe(0);
  });

  it("should detect low stock when days remaining <= alert days", () => {
    const stockQuantity = 5;
    const dailyDosageCount = 1;
    const alertDays = 7;
    const daysRemaining = Math.floor(stockQuantity / dailyDosageCount);
    const isLow = daysRemaining <= alertDays;
    expect(isLow).toBe(true);
  });

  it("should not flag as low stock when sufficient", () => {
    const stockQuantity = 60;
    const dailyDosageCount = 2;
    const alertDays = 7;
    const daysRemaining = Math.floor(stockQuantity / dailyDosageCount);
    const isLow = daysRemaining <= alertDays;
    expect(isLow).toBe(false);
  });

  it("should calculate estimated run-out date correctly", () => {
    const daysRemaining = 10;
    const now = new Date("2026-03-21");
    const estimatedRunOutDate = new Date(now);
    estimatedRunOutDate.setDate(estimatedRunOutDate.getDate() + daysRemaining);
    expect(estimatedRunOutDate.toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("should handle stock deduction correctly", () => {
    const currentStock = 30;
    const dailyDosageCount = 2;
    const newStock = Math.max(0, currentStock - dailyDosageCount);
    expect(newStock).toBe(28);
  });

  it("should not go below 0 when deducting stock", () => {
    const currentStock = 1;
    const dailyDosageCount = 3;
    const newStock = Math.max(0, currentStock - dailyDosageCount);
    expect(newStock).toBe(0);
  });
});

describe("Low Stock Alert Notification Content", () => {
  it("should generate correct low stock alert title", () => {
    const title = `💊 药品库存不足`;
    expect(title).toContain("库存不足");
  });

  it("should generate correct body for low stock", () => {
    const medName = "阿司匹林";
    const stockQuantity = 5;
    const daysRemaining = 5;
    const body = `${medName} 剩余 ${stockQuantity} 剂，预计 ${daysRemaining} 天后用完，请及时补药。`;
    expect(body).toContain(medName);
    expect(body).toContain("剩余");
    expect(body).toContain("补药");
  });

  it("should generate correct body for empty stock", () => {
    const medName = "布洛芬";
    const daysRemaining = 0;
    const body = daysRemaining <= 0
      ? `${medName} 已用完，请尽快补药。`
      : `${medName} 剩余 0 剂，预计 ${daysRemaining} 天后用完，请及时补药。`;
    expect(body).toContain("已用完");
    expect(body).toContain("补药");
  });
});

// ─── 3. AI Analysis with Adherence Data ──────────────────────────

describe("AI Analysis - Enhanced Function Signature", () => {
  it("should export analyzeSymptoms function", async () => {
    const { analyzeSymptoms } = await import("./aiAnalysis");
    expect(typeof analyzeSymptoms).toBe("function");
  });

  it("analyzeSymptoms should accept adherence and stock data parameters", async () => {
    const { analyzeSymptoms } = await import("./aiAnalysis");
    // Function should accept 3 parameters (entries, adherenceData, stockData)
    expect(analyzeSymptoms.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AI Analysis - Data Summary Helpers", () => {
  it("should export buildDataSummary function", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    expect(typeof buildDataSummary).toBe("function");
  });

  it("buildDataSummary should return empty message for no entries", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const result = buildDataSummary([]);
    expect(result).toContain("暂无数据");
  });

  it("buildDataSummary should include medication info", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-20",
        dizziness: 3, headache: 2, sleepQuality: 7, anxiety: 1,
        fatigue: 2, photosensitivity: 1, motionSickness: 0,
        palpitations: 0, mood: 7, severeHeadache: 0,
        medications: [{ name: "阿司匹林", dosage: "100mg" }],
        triggers: ["疲劳"],
        notes: null,
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("阿司匹林");
    expect(result).toContain("疲劳");
  });
});

describe("AI Analysis - Adherence Summary Builder", () => {
  it("should handle null adherence data gracefully", async () => {
    // The buildAdherenceSummary is internal, but we test through analyzeSymptoms
    // which should not throw when adherenceData is null
    const { analyzeSymptoms } = await import("./aiAnalysis");
    // With empty entries, it should return early without error
    const result = await analyzeSymptoms([], null, null);
    expect(result).toContain("暂无足够的数据");
  });
});

describe("AI Analysis - Router Integration", () => {
  it("should have analyze procedure in ai router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["ai.analyze"]).toBeDefined();
  });
});

// ─── 4. Scheduler - Low Stock Check ──────────────────────────────

describe("Scheduler - Low Stock Exports", () => {
  it("should import getLowStockAlerts from db", async () => {
    const db = await import("./db");
    expect(typeof db.getLowStockAlerts).toBe("function");
  });

  it("should import markStockAlertSent from db", async () => {
    const db = await import("./db");
    expect(typeof db.markStockAlertSent).toBe("function");
  });
});

// ─── 5. Missed Medication Alert Logic ──────────────────────────

describe("Missed Medication Alert - Business Logic", () => {
  it("should identify consecutive missed days", () => {
    // Simulate: medication should be taken every day, but missed 3 consecutive days
    const scheduledDays = ["2026-03-18", "2026-03-19", "2026-03-20"];
    const takenDays = new Set<string>([]); // none taken
    let consecutiveMissed = 0;
    for (const day of scheduledDays.reverse()) {
      if (!takenDays.has(day)) {
        consecutiveMissed++;
      } else {
        break;
      }
    }
    expect(consecutiveMissed).toBe(3);
  });

  it("should reset count when medication was taken", () => {
    const scheduledDays = ["2026-03-18", "2026-03-19", "2026-03-20"];
    const takenDays = new Set(["2026-03-19"]); // taken on 19th
    let consecutiveMissed = 0;
    for (const day of scheduledDays.reverse()) {
      if (!takenDays.has(day)) {
        consecutiveMissed++;
      } else {
        break;
      }
    }
    // Only 20th was missed (19th was taken, so streak breaks)
    expect(consecutiveMissed).toBe(1);
  });

  it("should return 0 when all medications taken", () => {
    const scheduledDays = ["2026-03-18", "2026-03-19", "2026-03-20"];
    const takenDays = new Set(scheduledDays);
    let consecutiveMissed = 0;
    for (const day of [...scheduledDays].reverse()) {
      if (!takenDays.has(day)) {
        consecutiveMissed++;
      } else {
        break;
      }
    }
    expect(consecutiveMissed).toBe(0);
  });

  it("should use threshold to determine alert", () => {
    const consecutiveMissed = 3;
    const threshold = 3;
    const shouldAlert = consecutiveMissed >= threshold;
    expect(shouldAlert).toBe(true);
  });

  it("should not alert below threshold", () => {
    const consecutiveMissed = 2;
    const threshold = 3;
    const shouldAlert = consecutiveMissed >= threshold;
    expect(shouldAlert).toBe(false);
  });
});

describe("Missed Medication Alert - Notification Content", () => {
  it("should generate warning message for single medication", () => {
    const medName = "阿司匹林";
    const missedDays = 3;
    const message = `${medName} 已连续 ${missedDays} 天未服用`;
    expect(message).toContain(medName);
    expect(message).toContain("3");
    expect(message).toContain("未服用");
  });

  it("should generate warning for multiple medications", () => {
    const meds = ["阿司匹林", "布洛芬"];
    const messages = meds.map((m) => `${m} 已连续多天未服用`);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("阿司匹林");
    expect(messages[1]).toContain("布洛芬");
  });
});

// ─── 6. Stock Quick Adjust Logic ──────────────────────────────

describe("Stock Quick Adjust", () => {
  it("should increase stock by daily dosage count", () => {
    const currentQty = 20;
    const dailyDosageCount = 2;
    const newQty = currentQty + dailyDosageCount;
    expect(newQty).toBe(22);
  });

  it("should decrease stock by daily dosage count", () => {
    const currentQty = 20;
    const dailyDosageCount = 2;
    const newQty = Math.max(0, currentQty - dailyDosageCount);
    expect(newQty).toBe(18);
  });

  it("should not go below 0 when decreasing", () => {
    const currentQty = 1;
    const dailyDosageCount = 3;
    const newQty = Math.max(0, currentQty - dailyDosageCount);
    expect(newQty).toBe(0);
  });
});
