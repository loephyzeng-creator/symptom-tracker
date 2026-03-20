import { describe, expect, it } from "vitest";
import { generateReportHTML } from "./report";

const sampleEntries = [
  {
    date: "2026-03-15",
    dizziness: 5,
    headache: 3,
    sleepQuality: 6,
    anxiety: 4,
    fatigue: 7,
    photosensitivity: 2,
    motionSickness: 3,
    palpitations: 1,
    mood: 6,
    medications: [{ name: "布洛芬", dosage: "200mg" }],
    triggers: ["睡眠不足", "天气变化"],
    notes: "今天感觉还行",
  },
  {
    date: "2026-03-16",
    dizziness: 7,
    headache: 6,
    sleepQuality: 4,
    anxiety: 5,
    fatigue: 8,
    photosensitivity: 4,
    motionSickness: 5,
    palpitations: 3,
    mood: 4,
    medications: [
      { name: "布洛芬", dosage: "200mg" },
      { name: "维生素B", dosage: "1片" },
    ],
    triggers: ["睡眠不足", "压力大"],
    notes: null,
  },
];

describe("generateReportHTML", () => {
  it("generates valid HTML with correct structure", () => {
    const html = generateReportHTML(
      sampleEntries,
      "2026-03-15",
      "2026-03-16",
      "测试用户"
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("症状日记 · 就诊报告");
    expect(html).toContain("测试用户");
    expect(html).toContain("3月15日");
    expect(html).toContain("3月16日");
    expect(html).toContain("共 2 条记录");
  });

  it("includes symptom scores in the table", () => {
    const html = generateReportHTML(
      sampleEntries,
      "2026-03-15",
      "2026-03-16",
      "用户"
    );

    // Average row should exist
    expect(html).toContain("平均");
    // Medication should be listed
    expect(html).toContain("布洛芬");
    expect(html).toContain("维生素B");
  });

  it("includes trigger frequency section", () => {
    const html = generateReportHTML(
      sampleEntries,
      "2026-03-15",
      "2026-03-16",
      "用户"
    );

    expect(html).toContain("诱因频率统计");
    expect(html).toContain("睡眠不足");
    expect(html).toContain("天气变化");
    expect(html).toContain("压力大");
  });

  it("includes medication summary", () => {
    const html = generateReportHTML(
      sampleEntries,
      "2026-03-15",
      "2026-03-16",
      "用户"
    );

    expect(html).toContain("用药记录汇总");
    expect(html).toContain("布洛芬 200mg");
  });

  it("includes notes summary", () => {
    const html = generateReportHTML(
      sampleEntries,
      "2026-03-15",
      "2026-03-16",
      "用户"
    );

    expect(html).toContain("备注摘要");
    expect(html).toContain("今天感觉还行");
  });

  it("handles empty entries gracefully", () => {
    const html = generateReportHTML(
      [],
      "2026-03-01",
      "2026-03-31",
      "空用户"
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("共 0 条记录");
    expect(html).not.toContain("诱因频率统计");
    expect(html).not.toContain("用药记录汇总");
    expect(html).not.toContain("备注摘要");
  });

  it("handles legacy string medications", () => {
    const entries = [
      {
        date: "2026-03-10",
        dizziness: 3,
        headache: 2,
        sleepQuality: 7,
        anxiety: 1,
        fatigue: 2,
        photosensitivity: 0,
        motionSickness: 1,
        palpitations: 0,
        mood: 8,
        medications: "阿司匹林,维生素C" as any,
        triggers: [],
        notes: null,
      },
    ];

    const html = generateReportHTML(entries, "2026-03-10", "2026-03-10", "用户");
    expect(html).toContain("阿司匹林");
    expect(html).toContain("维生素C");
  });

  it("escapes HTML in user content", () => {
    const entries = [
      {
        date: "2026-03-10",
        dizziness: 3,
        headache: 2,
        sleepQuality: 7,
        anxiety: 1,
        fatigue: 2,
        photosensitivity: 0,
        motionSickness: 1,
        palpitations: 0,
        mood: 8,
        medications: [],
        triggers: ['<script>alert("xss")</script>'],
        notes: '<img src=x onerror=alert(1)>',
      },
    ];

    const html = generateReportHTML(entries, "2026-03-10", "2026-03-10", "用户");
    expect(html).not.toContain("<script>");
    // onerror= is escaped to onerror&#61; which prevents XSS execution
    expect(html).not.toContain("onerror=");
    expect(html).toContain("onerror&#61;");
    expect(html).toContain("&lt;script&gt;");
  });
});
