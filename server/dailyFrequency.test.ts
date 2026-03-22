import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const schemaCode = readFileSync(
  path.resolve(__dirname, "../drizzle/schema.ts"),
  "utf-8"
);

const routersCode = readFileSync(
  path.resolve(__dirname, "./routers.ts"),
  "utf-8"
);

const schedulerCode = readFileSync(
  path.resolve(__dirname, "./reminderScheduler.ts"),
  "utf-8"
);

const uiCode = readFileSync(
  path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx"),
  "utf-8"
);

describe("Daily Push Frequency: Database Schema", () => {
  it("should include 'daily' in weeklyReportFrequency enum", () => {
    expect(schemaCode).toContain('"daily"');
    // Verify it's in the enum alongside other values
    expect(schemaCode).toMatch(/mysqlEnum.*weeklyReportFrequency.*daily/);
  });
});

describe("Daily Push Frequency: Backend Router", () => {
  it("should accept 'daily' in the updateWeeklyReportFrequency mutation", () => {
    // The z.enum should include 'daily'
    expect(routersCode).toMatch(/z\.enum\(\[.*"daily".*\]\)/);
  });
});

describe("Daily Push Frequency: Scheduler Logic", () => {
  it("should handle daily frequency in sendWeeklyPainkillerReports", () => {
    expect(schedulerCode).toContain('frequency === "daily"');
  });

  it("daily frequency should always return true (send every day)", () => {
    // The daily branch should return true unconditionally
    expect(schedulerCode).toMatch(/frequency === "daily"[\s\S]*?return true/);
  });

  it("should still check hour and lastWeeklyReportDate before daily frequency", () => {
    // Ensure the hour check and duplicate check happen before frequency check
    const hourCheckIdx = schedulerCode.indexOf("currentHour !== reportHour");
    const lastDateIdx = schedulerCode.indexOf("lastWeeklyReportDate === todayStr");
    const dailyIdx = schedulerCode.indexOf('frequency === "daily"');
    expect(hourCheckIdx).toBeLessThan(dailyIdx);
    expect(lastDateIdx).toBeLessThan(dailyIdx);
  });
});

describe("Daily Push Frequency: Frontend UI", () => {
  it("should include daily option in FREQUENCY_OPTIONS", () => {
    expect(uiCode).toContain('"daily"');
  });

  it("daily option should have correct label and description", () => {
    // Check for the Chinese labels
    expect(uiCode).toMatch(/daily.*\u6bcf\u65e5/);
    expect(uiCode).toMatch(/\u6bcf\u5929\u63a8\u9001/);
  });

  it("should accept 'daily' in handleFrequencyChange type", () => {
    expect(uiCode).toContain('"daily" | "weekly" | "biweekly" | "monthly"');
  });

  it("section title should say '报告推送频率' not '周报推送频率'", () => {
    expect(uiCode).toContain("\u62a5\u544a\u63a8\u9001\u9891\u7387");
    expect(uiCode).not.toContain("\u5468\u62a5\u63a8\u9001\u9891\u7387");
  });

  it("daily option should appear first in the list", () => {
    const dailyIdx = uiCode.indexOf('"daily"');
    const weeklyIdx = uiCode.indexOf('"weekly"');
    expect(dailyIdx).toBeLessThan(weeklyIdx);
  });
});
