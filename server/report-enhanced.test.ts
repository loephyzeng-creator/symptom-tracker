import { describe, it, expect } from "vitest";
import { generateReportHTML } from "./report";

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
    notes: null,
    ...overrides,
  };
}

describe("Enhanced Report Generation", () => {
  it("generates report with trend analysis section when enough entries", () => {
    const entries = [
      makeEntry({ date: "2025-03-01", dizziness: 7, headache: 6 }),
      makeEntry({ date: "2025-03-02", dizziness: 7, headache: 6 }),
      makeEntry({ date: "2025-03-03", dizziness: 4, headache: 3 }),
      makeEntry({ date: "2025-03-04", dizziness: 3, headache: 2 }),
    ];
    const html = generateReportHTML(entries, "2025-03-01", "2025-03-04", "测试用户");
    expect(html).toContain("趋势分析");
    expect(html).toContain("改善");
  });

  it("generates report with trigger correlation section", () => {
    const entries = [
      makeEntry({ date: "2025-03-01", triggers: ["睡眠不足"], dizziness: 8, headache: 7 }),
      makeEntry({ date: "2025-03-02", triggers: ["睡眠不足"], dizziness: 7, headache: 6 }),
      makeEntry({ date: "2025-03-03", triggers: [], dizziness: 3, headache: 2 }),
      makeEntry({ date: "2025-03-04", triggers: [], dizziness: 2, headache: 2 }),
    ];
    const html = generateReportHTML(entries, "2025-03-01", "2025-03-04", "测试用户");
    expect(html).toContain("诱因-症状关联分析");
    expect(html).toContain("睡眠不足");
  });

  it("includes medication summary in report", () => {
    const entries = [
      makeEntry({ date: "2025-03-01", medications: [{ name: "甲磺酸倍他司汀", dosage: "6mg" }] }),
      makeEntry({ date: "2025-03-02", medications: [{ name: "甲磺酸倍他司汀", dosage: "6mg" }, { name: "布洛芬", dosage: "200mg" }] }),
    ];
    const html = generateReportHTML(entries, "2025-03-01", "2025-03-02", "测试用户");
    expect(html).toContain("用药记录汇总");
    expect(html).toContain("甲磺酸倍他司汀");
    expect(html).toContain("布洛芬");
  });

  it("includes notes summary in report", () => {
    const entries = [
      makeEntry({ date: "2025-03-01", notes: "今天感觉好多了" }),
      makeEntry({ date: "2025-03-02", notes: null }),
    ];
    const html = generateReportHTML(entries, "2025-03-01", "2025-03-02", "测试用户");
    expect(html).toContain("备注摘要");
    expect(html).toContain("今天感觉好多了");
  });

  it("handles empty entries gracefully", () => {
    const html = generateReportHTML([], "2025-03-01", "2025-03-04", "测试用户");
    expect(html).toContain("症状日记");
    expect(html).toContain("0 条记录");
  });

  it("escapes HTML in user name and notes", () => {
    const entries = [
      makeEntry({ date: "2025-03-01", notes: "<script>alert('xss')</script>" }),
    ];
    const html = generateReportHTML(entries, "2025-03-01", "2025-03-01", "<b>恶意</b>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>恶意</b>");
  });

  it("report contains proper print styles", () => {
    const entries = [makeEntry()];
    const html = generateReportHTML(entries, "2025-03-15", "2025-03-15", "用户");
    expect(html).toContain("@page");
    expect(html).toContain("@media print");
  });

  it("handles entries with no triggers for correlation", () => {
    const entries = [
      makeEntry({ date: "2025-03-01", triggers: [] }),
      makeEntry({ date: "2025-03-02", triggers: [] }),
      makeEntry({ date: "2025-03-03", triggers: [] }),
    ];
    const html = generateReportHTML(entries, "2025-03-01", "2025-03-03", "用户");
    // Should not contain correlation section when no triggers
    expect(html).not.toContain("诱因-症状关联分析");
  });
});
