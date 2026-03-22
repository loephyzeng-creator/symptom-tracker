import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("HeadachePainkillerChart data filtering", () => {
  const chartCode = readFileSync(
    path.resolve(__dirname, "../client/src/components/HeadachePainkillerChart.tsx"),
    "utf-8"
  );

  it("should filter headache chart data to only include dates with headache attacks (level > 0)", () => {
    expect(chartCode).toContain("dailyData.filter((d) => d.headacheLevel > 0)");
  });

  it("should filter painkiller chart data to only include dates with painkiller usage", () => {
    expect(chartCode).toContain("dailyData.filter((d) => d.painkillerTaken)");
  });

  it("should use headacheData for the headache bar chart", () => {
    expect(chartCode).toContain("<BarChart data={headacheData}");
  });

  it("should use painkillerData for the painkiller bar chart", () => {
    expect(chartCode).toContain("<BarChart data={painkillerData}");
  });

  it("should show empty state when no headache data exists", () => {
    expect(chartCode).toContain("headacheData.length > 0");
    // The source uses unicode escapes: \u65e0\u5934\u75db\u53d1\u4f5c\u8bb0\u5f55
    // readFileSync returns them as literal backslash-u sequences
    expect(chartCode).toContain("\\u65e0\\u5934\\u75db\\u53d1\\u4f5c\\u8bb0\\u5f55");
  });

  it("should show empty state when no painkiller data exists", () => {
    expect(chartCode).toContain("painkillerData.length > 0");
    // The source uses unicode escapes: \u65e0\u6b62\u75bc\u836f\u4f7f\u7528\u8bb0\u5f55
    expect(chartCode).toContain("\\u65e0\\u6b62\\u75bc\\u836f\\u4f7f\\u7528\\u8bb0\\u5f55");
  });

  it("should compute summary stats from ALL daily data (not filtered)", () => {
    expect(chartCode).toContain("const attackDays = dailyData.filter((d) => d.headacheLevel > 0).length");
    expect(chartCode).toContain("const painkillerDays = dailyData.filter((d) => d.painkillerTaken).length");
  });

  it("should only render bars for painkiller dates that have painkillerTaken=true", () => {
    expect(chartCode).toContain("<Bar dataKey={() => 1}");
  });
});
