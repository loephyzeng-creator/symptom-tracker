import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

describe("HeadachePainkillerChart data filtering", () => {
  const chartCode = readFileSync(
    path.resolve(__dirname, "../client/src/components/HeadachePainkillerChart.tsx"),
    "utf-8"
  );

  it("should filter headache chart data to only include dates with headache attacks (level > 0)", () => {
    // The headacheData should be filtered from dailyData
    expect(chartCode).toContain("dailyData.filter((d) => d.headacheLevel > 0)");
  });

  it("should filter painkiller chart data to only include dates with painkiller usage", () => {
    // The painkillerData should be filtered from dailyData
    expect(chartCode).toContain("dailyData.filter((d) => d.painkillerTaken)");
  });

  it("should use headacheData for the headache bar chart", () => {
    // The headache BarChart should use headacheData, not dailyData
    expect(chartCode).toContain("<BarChart data={headacheData}");
  });

  it("should use painkillerData for the painkiller bar chart", () => {
    // The painkiller BarChart should use painkillerData, not dailyData
    expect(chartCode).toContain("<BarChart data={painkillerData}");
  });

  it("should show empty state when no headache data exists", () => {
    expect(chartCode).toContain("headacheData.length > 0");
    expect(chartCode).toMatch(/\u8fd130\u5929\u65e0\u5934\u75db\u53d1\u4f5c\u8bb0\u5f55/);
  });

  it("should show empty state when no painkiller data exists", () => {
    expect(chartCode).toContain("painkillerData.length > 0");
    expect(chartCode).toMatch(/\u8fd130\u5929\u65e0\u6b62\u75bc\u836f\u4f7f\u7528\u8bb0\u5f55/);
  });

  it("should compute summary stats from ALL daily data (not filtered)", () => {
    // Summary should use dailyData, not headacheData/painkillerData
    expect(chartCode).toContain("const attackDays = dailyData.filter((d) => d.headacheLevel > 0).length");
    expect(chartCode).toContain("const painkillerDays = dailyData.filter((d) => d.painkillerTaken).length");
  });

  it("should only render bars for painkiller dates that have painkillerTaken=true", () => {
    // The painkiller bar chart should always show value 1 since we pre-filtered
    expect(chartCode).toContain("<Bar dataKey={() => 1}");
  });
});
