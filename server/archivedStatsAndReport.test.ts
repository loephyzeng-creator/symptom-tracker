import { describe, it, expect } from "vitest";
import { generateReportHTML } from "./report";
import fs from "fs";
import path from "path";
import { readRoutersContent } from "./test-compat";

function makeEntry(overrides: Record<string, any> = {}) {
  return {
    date: "2025-03-15",
    dizziness: 5,
    headache: 4,
    sleepQuality: 6,
    anxiety: 3,
    fatigue: 4,
    photosensitivity: 2,
    motionSickness: 3,
    palpitations: 2,
    mood: 6,
    medications: [{ name: "甲磺酸倍他司汀", dosage: "6mg" }],
    triggers: ["睡眠不足"],
    severeHeadache: 0,
    painkillerTaken: 0,
    notes: null,
    ...overrides,
  };
}

describe("Archived Medication Stats", () => {
  it("archivedStats route is defined in routers.ts", () => {
    const content = readRoutersContent();
    expect(content).toContain("archivedStats");
    expect(content).toContain("reminderId: z.number()");
  });

  it("archivedStats returns totalDays, takenDays, adherenceRate, dateRange", () => {
    const content = readRoutersContent();
    const statsStart = content.indexOf("archivedStats");
    const statsSlice = content.slice(statsStart, statsStart + 1500);
    expect(statsSlice).toContain("totalDays");
    expect(statsSlice).toContain("takenDays");
    expect(statsSlice).toContain("adherenceRate");
    expect(statsSlice).toContain("dateRange");
  });

  it("ArchivedMedStats component exists and uses trpc query", () => {
    const componentPath = path.resolve(__dirname, "../client/src/components/ArchivedMedStats.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("trpc.medReminders.archivedStats.useQuery");
    expect(content).toContain("reminderId");
    expect(content).toContain("totalDays");
    expect(content).toContain("takenDays");
    expect(content).toContain("adherenceRate");
  });

  it("ArchivedMedStats is integrated into MedicationReminders archived section", () => {
    const componentPath = path.resolve(__dirname, "../client/src/components/MedicationReminders.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("ArchivedMedStats");
    expect(content).toContain("import ArchivedMedStats");
  });

  it("ArchivedMedStats displays loading skeleton", () => {
    const componentPath = path.resolve(__dirname, "../client/src/components/ArchivedMedStats.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("animate-pulse");
  });

  it("ArchivedMedStats shows empty state when no data", () => {
    const componentPath = path.resolve(__dirname, "../client/src/components/ArchivedMedStats.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("暂无用药记录");
  });

  it("ArchivedMedStats uses color coding for adherence rate", () => {
    const componentPath = path.resolve(__dirname, "../client/src/components/ArchivedMedStats.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("text-green-500");
    expect(content).toContain("text-yellow-500");
    expect(content).toContain("text-red-400");
  });
});

describe("Enhanced Report with Adherence Data", () => {
  it("generateReportHTML accepts adherence data parameter", () => {
    const entries = [makeEntry()];
    const adherenceData = {
      overallRate: 85,
      perMedication: [
        { name: "甲磺酸倍他司汀", expected: 30, taken: 25, rate: 83 },
      ],
      dailyData: [
        { date: "2025-03-15", expected: 1, taken: 1, rate: 100 },
      ],
    };
    const html = generateReportHTML(
      entries, "2025-03-15", "2025-03-15", "测试用户",
      adherenceData
    );
    expect(html).toContain("用药依从性分析");
    expect(html).toContain("85%");
    expect(html).toContain("甲磺酸倍他司汀");
    expect(html).toContain("83%");
  });

  it("generateReportHTML accepts medication reminders parameter", () => {
    const entries = [makeEntry()];
    const medReminders = [
      {
        medicationName: "甲磺酸倍他司汀",
        dosage: "6mg",
        startDate: "2025-01-01",
        endDate: null,
        reminderTimes: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }],
        repeatDays: [1, 2, 3, 4, 5],
        enabled: 1,
      },
    ];
    const html = generateReportHTML(
      entries, "2025-03-15", "2025-03-15", "测试用户",
      null, medReminders
    );
    expect(html).toContain("用药方案概览");
    expect(html).toContain("甲磺酸倍他司汀");
    expect(html).toContain("6mg");
    expect(html).toContain("2次");
    expect(html).toContain("08:00");
    expect(html).toContain("20:00");
  });

  it("report shows archived medications separately", () => {
    const entries = [makeEntry()];
    const medReminders = [
      {
        medicationName: "活跃药品",
        dosage: "10mg",
        startDate: "2025-01-01",
        endDate: null,
        reminderTimes: [{ hour: 8, minute: 0 }],
        repeatDays: null,
        enabled: 1,
      },
      {
        medicationName: "已结束药品",
        dosage: "5mg",
        startDate: "2025-01-01",
        endDate: "2025-02-28",
        reminderTimes: [{ hour: 9, minute: 0 }],
        repeatDays: null,
        enabled: 1,
      },
    ];
    const html = generateReportHTML(
      entries, "2025-03-15", "2025-03-15", "测试用户",
      null, medReminders
    );
    expect(html).toContain("当前用药");
    expect(html).toContain("已结束用药");
    expect(html).toContain("活跃药品");
    expect(html).toContain("已结束药品");
  });

  it("report shows adherence progress bars with correct colors", () => {
    const entries = [makeEntry()];
    const adherenceData = {
      overallRate: 45,
      perMedication: [
        { name: "药品A", expected: 30, taken: 25, rate: 83 },
        { name: "药品B", expected: 30, taken: 15, rate: 50 },
        { name: "药品C", expected: 30, taken: 10, rate: 33 },
      ],
      dailyData: [],
    };
    const html = generateReportHTML(
      entries, "2025-03-15", "2025-03-15", "测试用户",
      adherenceData
    );
    // Green for high adherence
    expect(html).toContain("#7a9a6e");
    // Orange for medium
    expect(html).toContain("#e67e22");
    // Red for low
    expect(html).toContain("#dc3545");
  });

  it("report works without adherence data (backward compatible)", () => {
    const entries = [makeEntry()];
    const html = generateReportHTML(entries, "2025-03-15", "2025-03-15", "测试用户");
    expect(html).toContain("症状日记");
    expect(html).not.toContain("用药依从性分析");
    expect(html).not.toContain("用药方案概览");
  });

  it("report.generate route fetches adherence data", () => {
    const content = readRoutersContent();
    const reportStart = content.indexOf("report: router");
    const reportSlice = content.slice(reportStart, reportStart + 2000);
    expect(reportSlice).toContain("getMedicationAdherence");
    expect(reportSlice).toContain("getMedicationReminders");
    expect(reportSlice).toContain("adherenceData");
    expect(reportSlice).toContain("medRemindersList");
  });

  it("report shows repeat days as Chinese day names", () => {
    const entries = [makeEntry()];
    const medReminders = [
      {
        medicationName: "测试药",
        dosage: "1mg",
        startDate: null,
        endDate: null,
        reminderTimes: [{ hour: 8, minute: 0 }],
        repeatDays: [1, 3, 5],
        enabled: 1,
      },
    ];
    const html = generateReportHTML(
      entries, "2025-03-15", "2025-03-15", "测试用户",
      null, medReminders
    );
    expect(html).toContain("周一");
    expect(html).toContain("周三");
    expect(html).toContain("周五");
  });

  it("report shows '每天' for medications with all days or no repeat days", () => {
    const entries = [makeEntry()];
    const medReminders = [
      {
        medicationName: "每日药",
        dosage: "1mg",
        startDate: null,
        endDate: null,
        reminderTimes: [{ hour: 8, minute: 0 }],
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        enabled: 1,
      },
    ];
    const html = generateReportHTML(
      entries, "2025-03-15", "2025-03-15", "测试用户",
      null, medReminders
    );
    expect(html).toContain("每天");
  });
});
