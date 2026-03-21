/**
 * Tests for headache attack level and painkiller functionality.
 * Verifies schema, backend logic, and frontend UI changes.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Headache Attack Level + Painkiller Feature", () => {
  const dbPath = path.resolve(__dirname, "./db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");
  const routerPath = path.resolve(__dirname, "./routers.ts");
  const routerContent = fs.readFileSync(routerPath, "utf-8");
  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  describe("Database Schema", () => {
    it("should have painkillerTaken column in schema", () => {
      expect(schemaContent).toContain("painkillerTaken");
    });

    it("should have headacheAttack/severeHeadache column supporting 0-3 range", () => {
      // The column stores 0=none, 1=mild, 2=moderate, 3=severe
      expect(schemaContent).toContain("severeHeadache");
    });
  });

  describe("Backend - getPainkillerUsageLast30Days", () => {
    it("should export getPainkillerUsageLast30Days function", () => {
      expect(dbContent).toContain("export async function getPainkillerUsageLast30Days");
    });

    it("should filter by painkillerTaken = 1", () => {
      expect(dbContent).toContain("eq(symptomEntries.painkillerTaken, 1)");
    });

    it("should calculate 30-day window", () => {
      expect(dbContent).toContain("d.setDate(d.getDate() - 29)");
    });
  });

  describe("Router - painkillerUsage endpoint", () => {
    it("should have painkillerUsage query in entries router", () => {
      expect(routerContent).toContain("painkillerUsage: protectedProcedure");
    });

    it("should return days and dynamic limit", () => {
      expect(routerContent).toContain("days: count, limit");
      expect(routerContent).toContain("getPainkillerDayLimit");
    });

    it("should import getPainkillerUsageLast30Days", () => {
      expect(routerContent).toContain("getPainkillerUsageLast30Days");
    });
  });

  describe("Router - entry input schema", () => {
    it("should accept severeHeadache with range 0-3", () => {
      expect(routerContent).toMatch(/severeHeadache.*z\.number\(\)\.min\(0\)\.max\(3\)/);
    });

    it("should accept painkillerTaken field", () => {
      expect(routerContent).toContain("painkillerTaken: z.number()");
    });
  });

  describe("Frontend - SymptomForm UI", () => {
    const formPath = path.resolve(__dirname, "../client/src/components/SymptomForm.tsx");
    const formContent = fs.readFileSync(formPath, "utf-8");

    it("should have headacheAttack state instead of severeHeadache boolean", () => {
      expect(formContent).toContain("const [headacheAttack, setHeadacheAttack]");
    });

    it("should have painkillerTaken state", () => {
      expect(formContent).toContain("const [painkillerTaken, setPainkillerTaken]");
    });

    it("should display 4 headache levels: 无/轻微/明显/严重", () => {
      expect(formContent).toContain('"无"');
      expect(formContent).toContain('"轻微"');
      expect(formContent).toContain('"明显"');
      expect(formContent).toContain('"严重"');
    });

    it("should have painkiller toggle with Pill icon", () => {
      expect(formContent).toContain("Pill");
      expect(formContent).toContain("是否服用止疼药");
    });

    it("should show headache attack label instead of old severe headache", () => {
      expect(formContent).toContain("头痛发作");
      expect(formContent).not.toContain("是否剧烈头痛");
    });

    it("should have painkillerUsageCheck query for warnings", () => {
      expect(formContent).toContain("painkillerUsageCheck");
      expect(formContent).toContain("entries.painkillerUsage");
    });

    it("should show warning toast when painkiller usage is high", () => {
      expect(formContent).toContain("止疼药用量提醒");
      expect(formContent).toContain("建议不超过");
    });

    it("should display persistent 30-day painkiller usage counter", () => {
      expect(formContent).toContain("近30天累计服用止疼药");
      expect(formContent).toContain("painkillerUsageCheck.data.days");
      expect(formContent).toContain("painkillerUsageCheck.data.limit");
    });

    it("should enable painkillerUsageCheck query by default", () => {
      expect(formContent).toContain("enabled: true");
    });
  });

  describe("Frontend - QuickRecord UI", () => {
    const quickPath = path.resolve(__dirname, "../client/src/components/QuickRecord.tsx");
    const quickContent = fs.readFileSync(quickPath, "utf-8");

    it("should have headacheAttack state", () => {
      expect(quickContent).toContain("const [headacheAttack, setHeadacheAttack]");
    });

    it("should have painkillerTaken state", () => {
      expect(quickContent).toContain("const [painkillerTaken, setPainkillerTaken]");
    });

    it("should display headache attack level selector", () => {
      expect(quickContent).toContain("头痛发作");
    });

    it("should have painkiller toggle", () => {
      expect(quickContent).toContain("是否服用止疼药");
    });

    it("should have painkillerUsageCheck for warnings", () => {
      expect(quickContent).toContain("painkillerUsageCheck");
    });

    it("should display persistent 30-day painkiller usage counter", () => {
      expect(quickContent).toContain("近30天累计服用止疼药");
    });
  });

  describe("Frontend - HistoryView display", () => {
    const histPath = path.resolve(__dirname, "../client/src/components/HistoryView.tsx");
    const histContent = fs.readFileSync(histPath, "utf-8");

    it("should show headache attack levels instead of binary", () => {
      expect(histContent).toContain("头痛发作：");
      expect(histContent).not.toContain("当日发生剧烈头痛");
    });

    it("should show painkiller status", () => {
      expect(histContent).toContain("已服止疼药");
    });

    it("should display different colors for different headache levels", () => {
      expect(histContent).toContain("bg-chart-4/10 text-chart-4");
      expect(histContent).toContain("bg-terracotta/10 text-terracotta");
      expect(histContent).toContain("bg-destructive/10 text-destructive");
    });
  });

  describe("Frontend - CSV Export", () => {
    const hookPath = path.resolve(__dirname, "../client/src/hooks/useSymptomData.ts");
    const hookContent = fs.readFileSync(hookPath, "utf-8");

    it("should export headache attack level as text", () => {
      expect(hookContent).toContain('"头痛发作"');
      expect(hookContent).not.toContain('"剧烈头痛"');
    });

    it("should export painkiller column", () => {
      expect(hookContent).toContain('"止疼药"');
    });

    it("should map headache levels to text labels", () => {
      expect(hookContent).toMatch(/severeHeadache === 0.*无.*轻微.*明显.*严重/);
    });
  });

  describe("Backend - Report", () => {
    const reportPath = path.resolve(__dirname, "./report.ts");
    const reportContent = fs.readFileSync(reportPath, "utf-8");

    it("should show headache attack column header", () => {
      expect(reportContent).toContain("头痛发作");
      expect(reportContent).not.toContain(">剧烈头痛<");
    });

    it("should have painkiller column in report", () => {
      expect(reportContent).toContain("止疼药");
    });

    it("should include painkillerTaken in report type", () => {
      expect(reportContent).toContain("painkillerTaken?: number");
    });
  });

  describe("Backend - AI Analysis", () => {
    const aiPath = path.resolve(__dirname, "./aiAnalysis.ts");
    const aiContent = fs.readFileSync(aiPath, "utf-8");

    it("should include painkillerTaken in entry type", () => {
      expect(aiContent).toContain("painkillerTaken: number");
    });

    it("should count headache attack days", () => {
      expect(aiContent).toContain("头痛发作天数");
    });

    it("should count painkiller usage days", () => {
      expect(aiContent).toContain("止疼药使用天数");
    });

    it("should show headache attack levels in data table", () => {
      expect(aiContent).toContain("头痛发作");
      expect(aiContent).toContain("止疼药");
    });
  });

  describe("Frontend - SymptomSummary", () => {
    const summaryPath = path.resolve(__dirname, "../client/src/components/SymptomSummary.tsx");
    const summaryContent = fs.readFileSync(summaryPath, "utf-8");

    it("should have getHeadacheAttackStats function", () => {
      expect(summaryContent).toContain("function getHeadacheAttackStats");
    });

    it("should have getPainkillerDays function", () => {
      expect(summaryContent).toContain("function getPainkillerDays");
    });

    it("should show headache attack breakdown in summary", () => {
      expect(summaryContent).toContain("轻微");
      expect(summaryContent).toContain("明显");
      expect(summaryContent).toContain("严重");
    });

    it("should warn when painkiller usage exceeds 10 days", () => {
      expect(summaryContent).toContain("painkillerDays >= 10");
      expect(summaryContent).toContain("建议咨询医生");
    });
  });

  describe("Configurable Painkiller Threshold", () => {
    it("should have painkillerDayLimit column in schema", () => {
      expect(schemaContent).toContain("painkillerDayLimit");
    });

    it("should have getPainkillerDayLimit function in db.ts", () => {
      expect(dbContent).toContain("export async function getPainkillerDayLimit");
    });

    it("should have updatePainkillerDayLimit function in db.ts", () => {
      expect(dbContent).toContain("export async function updatePainkillerDayLimit");
    });

    it("should have updatePainkillerLimit endpoint in router", () => {
      expect(routerContent).toContain("updatePainkillerLimit: protectedProcedure");
    });

    it("should validate limit range 1-30", () => {
      expect(routerContent).toContain("z.number().min(1).max(30)");
    });

    it("should use dynamic limit from getPainkillerDayLimit in painkillerUsage", () => {
      expect(routerContent).toContain("const limit = await getPainkillerDayLimit");
    });

    it("should have PainkillerLimitSetting component", () => {
      const componentPath = path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx");
      const componentContent = fs.readFileSync(componentPath, "utf-8");
      expect(componentContent).toContain("painkillerDayLimit");
      expect(componentContent).toContain("updatePainkillerLimit");
      expect(componentContent).toContain("止疼药阈值已更新");
    });

    it("should include PainkillerLimitSetting in settings page", () => {
      const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
      const homeContent = fs.readFileSync(homePath, "utf-8");
      expect(homeContent).toContain("PainkillerLimitSetting");
      expect(homeContent).toContain("止疼药用量控制");
    });

    it("should include painkillerDayLimit in getSettings default", () => {
      expect(routerContent).toContain("painkillerDayLimit: 10");
    });
  });
});
