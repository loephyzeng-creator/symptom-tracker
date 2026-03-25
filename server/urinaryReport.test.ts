import { describe, it, expect } from "vitest";
import { generateUrinaryReportHTML } from "./urinaryReport";

const baseMedReminders = [
  {
    medicationName: "度洛西汀肠溶胶囊",
    dosage: "30mg",
    startDate: "2026-01-01",
    endDate: null,
    reminderTimes: [{ hour: 10, minute: 0 }],
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    enabled: 1,
  },
  {
    medicationName: "氟哌噻吨美利曲辛片",
    dosage: "1片",
    startDate: "2026-01-01",
    endDate: null,
    reminderTimes: [{ hour: 10, minute: 0 }],
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    enabled: 1,
  },
  {
    medicationName: "盐酸乙哌立松",
    dosage: "1片",
    startDate: "2026-01-01",
    endDate: null,
    reminderTimes: [{ hour: 10, minute: 0 }],
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    enabled: 1,
  },
];

function makeEntry(date: string, triggers: string[], meds: { name: string; dosage: string }[] = []) {
  return {
    date,
    dizziness: 3,
    headache: 2,
    sleepQuality: 5,
    anxiety: 3,
    fatigue: 4,
    photosensitivity: 1,
    motionSickness: 0,
    palpitations: 1,
    mood: 5,
    medications: meds,
    triggers,
    severeHeadache: 0,
    painkillerTaken: 0,
    notes: null,
  };
}

describe("generateUrinaryReportHTML", () => {
  it("generates valid HTML with report structure", () => {
    const entries = [
      makeEntry("2026-03-20", ["排尿困难", "尿等待"], [{ name: "度洛西汀肠溶胶囊", dosage: "30mg" }]),
      makeEntry("2026-03-21", ["白天嗜睡"], [{ name: "度洛西汀肠溶胶囊", dosage: "30mg" }]),
      makeEntry("2026-03-22", ["排尿困难"], [{ name: "度洛西汀肠溶胶囊", dosage: "30mg" }]),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-22", "测试用户", baseMedReminders);

    expect(html).toContain("泌尿症状-用药关联报告");
    expect(html).toContain("测试用户");
    expect(html).toContain("2026年3月20日");
    expect(html).toContain("2026年3月22日");
  });

  it("shows urinary symptom frequency distribution", () => {
    const entries = [
      makeEntry("2026-03-20", ["排尿困难", "尿等待"]),
      makeEntry("2026-03-21", ["排尿困难"]),
      makeEntry("2026-03-22", ["夜尿增多"]),
      makeEntry("2026-03-23", []),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-23", "用户", baseMedReminders);

    expect(html).toContain("排尿困难");
    expect(html).toContain("尿等待");
    expect(html).toContain("夜尿增多");
    expect(html).toContain("泌尿症状频率分布");
  });

  it("shows medication urinary risk assessment", () => {
    const entries = [makeEntry("2026-03-20", ["排尿困难"])];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-20", "用户", baseMedReminders);

    // 度洛西汀 should be high risk
    expect(html).toContain("度洛西汀肠溶胶囊");
    expect(html).toContain("高");
    // 氟哌噻吨美利曲辛 should be moderate risk
    expect(html).toContain("氟哌噻吨美利曲辛片");
    expect(html).toContain("中");
    // 乙哌立松 should be very low risk
    expect(html).toContain("盐酸乙哌立松");
    expect(html).toContain("极低");
  });

  it("shows multi-drug warning when multiple high/moderate risk drugs", () => {
    const entries = [makeEntry("2026-03-20", ["排尿困难"])];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-20", "用户", baseMedReminders);

    // Should show combined risk warning for 度洛西汀 (high) + 氟哌噻吨美利曲辛 (moderate)
    expect(html).toContain("多药联用叠加风险警告");
  });

  it("shows medication comparison between urinary and non-urinary days", () => {
    const meds = [{ name: "度洛西汀肠溶胶囊", dosage: "30mg" }];
    const entries = [
      makeEntry("2026-03-20", ["排尿困难"], meds),
      makeEntry("2026-03-21", [], meds),
      makeEntry("2026-03-22", ["排尿困难"], meds),
      makeEntry("2026-03-23", [], []),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-23", "用户", baseMedReminders);

    expect(html).toContain("泌尿症状日 vs 无症状日用药对比");
    expect(html).toContain("度洛西汀肠溶胶囊");
  });

  it("shows info message when no urinary symptoms recorded", () => {
    const entries = [
      makeEntry("2026-03-20", ["白天嗜睡"]),
      makeEntry("2026-03-21", []),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-21", "用户", baseMedReminders);

    expect(html).toContain("未记录到泌尿系统症状");
  });

  it("includes doctor visit suggestions section", () => {
    const entries = [
      makeEntry("2026-03-20", ["排尿困难"]),
      makeEntry("2026-03-21", []),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-21", "用户", baseMedReminders);

    expect(html).toContain("复诊建议要点");
    expect(html).toContain("度洛西汀");
    expect(html).toContain("泌尿系统高风险药物");
  });

  it("includes print toolbar", () => {
    const entries = [makeEntry("2026-03-20", [])];
    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-20", "用户");

    expect(html).toContain("打印 / 保存 PDF");
    expect(html).toContain("window.print()");
  });

  it("handles empty medication reminders gracefully", () => {
    const entries = [makeEntry("2026-03-20", ["排尿困难"])];
    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-20", "用户", null);

    expect(html).toContain("暂无用药提醒数据");
  });

  it("shows weekly trend when multiple weeks of data", () => {
    const entries = [
      makeEntry("2026-03-10", ["排尿困难"]),
      makeEntry("2026-03-11", []),
      makeEntry("2026-03-17", ["排尿困难", "尿等待"]),
      makeEntry("2026-03-18", ["排尿困难"]),
      makeEntry("2026-03-24", []),
      makeEntry("2026-03-25", []),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-10", "2026-03-25", "用户", baseMedReminders);

    expect(html).toContain("泌尿症状每周趋势");
  });

  it("shows detailed urinary symptom day records", () => {
    const meds = [{ name: "度洛西汀肠溶胶囊", dosage: "30mg" }];
    const entries = [
      { ...makeEntry("2026-03-20", ["排尿困难", "白天嗜睡"], meds), notes: "早上排尿困难明显" },
      makeEntry("2026-03-21", [], meds),
    ];

    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-21", "用户", baseMedReminders);

    expect(html).toContain("泌尿症状出现日明细");
    expect(html).toContain("早上排尿困难明显");
  });

  it("includes disclaimer footer", () => {
    const entries = [makeEntry("2026-03-20", [])];
    const html = generateUrinaryReportHTML(entries, "2026-03-20", "2026-03-20", "用户");

    expect(html).toContain("不构成医学诊断或治疗建议");
    expect(html).toContain("咨询专业医生");
  });
});
