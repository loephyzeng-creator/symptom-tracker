import { describe, it, expect } from "vitest";

describe("AI Analysis - buildDataSummary", () => {
  it("should be an exported function", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    expect(typeof buildDataSummary).toBe("function");
  });

  it("should return empty message for no entries", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const result = buildDataSummary([]);
    expect(result).toContain("暂无数据");
  });

  it("should include date range in summary", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-01",
        dizziness: 3, headache: 2, sleepQuality: 7, anxiety: 1,
        fatigue: 2, photosensitivity: 1, motionSickness: 0, palpitations: 0, mood: 7,
        severeHeadache: 0, medications: [], triggers: [], notes: null,
      },
      {
        date: "2026-03-10",
        dizziness: 5, headache: 4, sleepQuality: 5, anxiety: 3,
        fatigue: 4, photosensitivity: 2, motionSickness: 1, palpitations: 1, mood: 5,
        severeHeadache: 0, medications: [], triggers: [], notes: null,
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("2026-03-01");
    expect(result).toContain("2026-03-10");
    expect(result).toContain("共 2 天");
  });

  it("should include averages in summary", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-01",
        dizziness: 4, headache: 6, sleepQuality: 8, anxiety: 2,
        fatigue: 3, photosensitivity: 1, motionSickness: 0, palpitations: 0, mood: 7,
        severeHeadache: 0, medications: [], triggers: [], notes: null,
      },
      {
        date: "2026-03-02",
        dizziness: 6, headache: 4, sleepQuality: 6, anxiety: 4,
        fatigue: 5, photosensitivity: 3, motionSickness: 2, palpitations: 2, mood: 5,
        severeHeadache: 1, medications: [], triggers: [], notes: null,
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("头晕脑胀: 5");
    expect(result).toContain("头痛程度: 5");
    expect(result).toContain("头痛发作天数：1 天");
  });

  it("should include trigger frequency", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-01",
        dizziness: 3, headache: 2, sleepQuality: 7, anxiety: 1,
        fatigue: 2, photosensitivity: 1, motionSickness: 0, palpitations: 0, mood: 7,
        severeHeadache: 0, medications: [], triggers: ["睡眠不足", "压力大"], notes: null,
      },
      {
        date: "2026-03-02",
        dizziness: 5, headache: 4, sleepQuality: 5, anxiety: 3,
        fatigue: 4, photosensitivity: 2, motionSickness: 1, palpitations: 1, mood: 5,
        severeHeadache: 0, medications: [], triggers: ["睡眠不足"], notes: null,
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("睡眠不足(2次)");
    expect(result).toContain("压力大(1次)");
  });

  it("should include medication frequency", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-01",
        dizziness: 3, headache: 2, sleepQuality: 7, anxiety: 1,
        fatigue: 2, photosensitivity: 1, motionSickness: 0, palpitations: 0, mood: 7,
        severeHeadache: 0,
        medications: [{ name: "布洛芬", dosage: "200mg" }],
        triggers: [], notes: null,
      },
      {
        date: "2026-03-02",
        dizziness: 5, headache: 4, sleepQuality: 5, anxiety: 3,
        fatigue: 4, photosensitivity: 2, motionSickness: 1, palpitations: 1, mood: 5,
        severeHeadache: 0,
        medications: [{ name: "布洛芬", dosage: "200mg" }, { name: "维生素B", dosage: "" }],
        triggers: [], notes: null,
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("布洛芬 200mg(2次)");
    expect(result).toContain("维生素B(1次)");
  });

  it("should handle string medications format", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-01",
        dizziness: 3, headache: 2, sleepQuality: 7, anxiety: 1,
        fatigue: 2, photosensitivity: 1, motionSickness: 0, palpitations: 0, mood: 7,
        severeHeadache: 0,
        medications: JSON.stringify([{ name: "阿司匹林", dosage: "100mg" }]),
        triggers: JSON.stringify(["天气变化"]),
        notes: null,
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("阿司匹林 100mg");
    expect(result).toContain("天气变化");
  });

  it("should include per-day data table", async () => {
    const { buildDataSummary } = await import("./aiAnalysis");
    const entries = [
      {
        date: "2026-03-01",
        dizziness: 3, headache: 2, sleepQuality: 7, anxiety: 1,
        fatigue: 2, photosensitivity: 1, motionSickness: 0, palpitations: 0, mood: 7,
        severeHeadache: 0, medications: [], triggers: [], notes: "感觉不错",
      },
    ];
    const result = buildDataSummary(entries);
    expect(result).toContain("最近记录明细");
    expect(result).toContain("2026-03-01");
    expect(result).toContain("感觉不错");
  });
});

describe("AI Analysis - analyzeSymptoms", () => {
  it("should be an exported function", async () => {
    const { analyzeSymptoms } = await import("./aiAnalysis");
    expect(typeof analyzeSymptoms).toBe("function");
  });

  it("should return message for empty entries", async () => {
    const { analyzeSymptoms } = await import("./aiAnalysis");
    const result = await analyzeSymptoms([]);
    expect(result).toContain("暂无足够的数据");
  });
});

describe("AI Analysis - Router", () => {
  it("should have ai.analyze procedure in appRouter", async () => {
    const { appRouter } = await import("./routers");
    const procedures = (appRouter as any)._def.procedures;
    expect(procedures["ai.analyze"]).toBeDefined();
  });
});
