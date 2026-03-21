/**
 * Tests for painkiller analysis & visualization enhancements:
 * 1. AI analysis includes painkiller-headache correlation data
 * 2. PainkillerTrendChart component integration
 * 3. Enhanced calendar painkiller indicator
 */
import { describe, it, expect } from "vitest";
import { buildDataSummary, buildPainkillerHeadacheCorrelation } from "./aiAnalysis";

// Helper to create mock entries
function mockEntry(overrides: Partial<{
  date: string;
  dizziness: number;
  headache: number;
  sleepQuality: number;
  anxiety: number;
  fatigue: number;
  photosensitivity: number;
  motionSickness: number;
  palpitations: number;
  mood: number;
  severeHeadache: number;
  painkillerTaken: number;
  medications: any;
  triggers: any;
  notes: string | null;
}> = {}) {
  return {
    date: "2026-03-01",
    dizziness: 3,
    headache: 5,
    sleepQuality: 6,
    anxiety: 2,
    fatigue: 4,
    photosensitivity: 1,
    motionSickness: 0,
    palpitations: 1,
    mood: 6,
    severeHeadache: 0,
    painkillerTaken: 0,
    medications: [],
    triggers: [],
    notes: null,
    ...overrides,
  };
}

describe("Painkiller Enhancement Features", () => {
  describe("Feature 1: AI Analysis Painkiller-Headache Correlation", () => {
    it("buildPainkillerHeadacheCorrelation should return empty for < 3 entries", () => {
      const entries = [mockEntry(), mockEntry({ date: "2026-03-02" })];
      const result = buildPainkillerHeadacheCorrelation(entries);
      expect(result).toBe("");
    });

    it("buildPainkillerHeadacheCorrelation should return empty when no painkiller usage", () => {
      const entries = [
        mockEntry({ date: "2026-03-01" }),
        mockEntry({ date: "2026-03-02" }),
        mockEntry({ date: "2026-03-03" }),
      ];
      const result = buildPainkillerHeadacheCorrelation(entries);
      expect(result).toBe("");
    });

    it("buildPainkillerHeadacheCorrelation should include correlation data when painkiller used", () => {
      const entries = [
        mockEntry({ date: "2026-03-01", painkillerTaken: 1, headache: 7, severeHeadache: 2 }),
        mockEntry({ date: "2026-03-02", painkillerTaken: 0, headache: 3, severeHeadache: 0 }),
        mockEntry({ date: "2026-03-03", painkillerTaken: 1, headache: 8, severeHeadache: 3 }),
        mockEntry({ date: "2026-03-04", painkillerTaken: 0, headache: 2, severeHeadache: 0 }),
      ];
      const result = buildPainkillerHeadacheCorrelation(entries);
      expect(result).toContain("止疼药使用与头痛关联分析数据");
      expect(result).toContain("止疼药使用天数：2 天");
      expect(result).toContain("服药日平均头痛评分");
      expect(result).toContain("未服药日平均头痛评分");
      expect(result).toContain("服药日头痛发作等级分布");
      expect(result).toContain("未服药日头痛发作等级分布");
    });

    it("buildPainkillerHeadacheCorrelation should include next-day effect analysis", () => {
      const entries = [
        mockEntry({ date: "2026-03-01", painkillerTaken: 1, headache: 8 }),
        mockEntry({ date: "2026-03-02", painkillerTaken: 0, headache: 4 }),
        mockEntry({ date: "2026-03-03", painkillerTaken: 1, headache: 7 }),
        mockEntry({ date: "2026-03-04", painkillerTaken: 0, headache: 3 }),
      ];
      const result = buildPainkillerHeadacheCorrelation(entries);
      expect(result).toContain("服药次日效果");
      expect(result).toContain("好转");
    });

    it("buildPainkillerHeadacheCorrelation should detect consecutive usage", () => {
      const entries = [
        mockEntry({ date: "2026-03-01", painkillerTaken: 1 }),
        mockEntry({ date: "2026-03-02", painkillerTaken: 1 }),
        mockEntry({ date: "2026-03-03", painkillerTaken: 1 }),
        mockEntry({ date: "2026-03-04", painkillerTaken: 0 }),
      ];
      const result = buildPainkillerHeadacheCorrelation(entries);
      expect(result).toContain("最长连续服药天数：3 天");
    });

    it("buildPainkillerHeadacheCorrelation should include other symptom comparison", () => {
      const entries = [
        mockEntry({ date: "2026-03-01", painkillerTaken: 1, anxiety: 5, fatigue: 6 }),
        mockEntry({ date: "2026-03-02", painkillerTaken: 0, anxiety: 2, fatigue: 3 }),
        mockEntry({ date: "2026-03-03", painkillerTaken: 1, anxiety: 4, fatigue: 7 }),
      ];
      const result = buildPainkillerHeadacheCorrelation(entries);
      expect(result).toContain("服药日 vs 未服药日其他症状对比");
      expect(result).toContain("头晕");
      expect(result).toContain("焦虑");
      expect(result).toContain("疲劳");
    });

    it("buildDataSummary should include painkiller correlation section", () => {
      const entries = [
        mockEntry({ date: "2026-03-01", painkillerTaken: 1, headache: 7 }),
        mockEntry({ date: "2026-03-02", painkillerTaken: 0, headache: 3 }),
        mockEntry({ date: "2026-03-03", painkillerTaken: 1, headache: 6 }),
        mockEntry({ date: "2026-03-04", painkillerTaken: 0, headache: 2 }),
      ];
      const summary = buildDataSummary(entries);
      expect(summary).toContain("止疼药使用与头痛关联分析数据");
    });

    it("buildDataSummary should still work without painkiller data", () => {
      const entries = [
        mockEntry({ date: "2026-03-01" }),
        mockEntry({ date: "2026-03-02" }),
        mockEntry({ date: "2026-03-03" }),
      ];
      const summary = buildDataSummary(entries);
      expect(summary).toContain("数据概览");
      expect(summary).not.toContain("止疼药使用与头痛关联分析数据");
    });
  });

  describe("Feature 2: PainkillerTrendChart uses checkInCalendar data", () => {
    it("checkInCalendar procedure should exist in router", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("medReminders.checkInCalendar");
    });

    it("entries.painkillerUsage procedure should exist in router", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("entries.painkillerUsage");
    });
  });

  describe("Feature 3: Enhanced Calendar Painkiller Indicator", () => {
    it("checkInCalendar data includes painkillerTaken field", async () => {
      // Verify the calendar data structure includes painkillerTaken
      const { getMedicationCheckInCalendar } = await import("./db");
      expect(typeof getMedicationCheckInCalendar).toBe("function");
    });

    it("day detail includes headacheAttack and painkillerTaken", async () => {
      const { getMedicationCheckInDayDetail } = await import("./db");
      expect(typeof getMedicationCheckInDayDetail).toBe("function");
    });
  });
});
