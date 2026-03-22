import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const chartCode = readFileSync(
  path.resolve(__dirname, "../client/src/components/HeadachePainkillerChart.tsx"),
  "utf-8"
);

const statsViewCode = readFileSync(
  path.resolve(__dirname, "../client/src/components/StatsView.tsx"),
  "utf-8"
);

describe("Chart Enhancement: Date Range Selector", () => {
  it("should accept rangeDays prop with default value of 30", () => {
    expect(chartCode).toContain("rangeDays?: number");
    expect(chartCode).toContain("rangeDays = 30");
  });

  it("should NOT hardcode 30-day cutoff filter internally", () => {
    // The old code had: cutoff.setDate(cutoff.getDate() - 30)
    // Now entries are pre-filtered by parent StatsView
    expect(chartCode).not.toContain("cutoff.setDate(cutoff.getDate() - 30)");
  });

  it("should use rangeDays to generate dynamic range labels", () => {
    expect(chartCode).toContain("getRangeLabel");
    expect(chartCode).toContain("rangeLabel");
  });

  it("StatsView should pass rangeDays prop to HeadachePainkillerChart", () => {
    expect(statsViewCode).toContain("rangeDays={");
    expect(statsViewCode).toContain("HeadachePainkillerChart");
  });

  it("should display range label in summary cards", () => {
    // The summary text should use rangeLabel instead of hardcoded "近30天"
    expect(chartCode).toContain("{rangeLabel}");
  });
});

describe("Chart Enhancement: Painkiller Brand/Dosage Tooltip", () => {
  it("should include painkillerBrand in DayData interface", () => {
    expect(chartCode).toContain("painkillerBrand");
  });

  it("should include painkillerDosage in DayData interface", () => {
    expect(chartCode).toContain("painkillerDosage");
  });

  it("should map painkillerBrand from entries in dailyData", () => {
    expect(chartCode).toMatch(/painkillerBrand.*painkillerBrand/);
  });

  it("should map painkillerDosage from entries in dailyData", () => {
    expect(chartCode).toMatch(/painkillerDosage.*painkillerDosage/);
  });

  it("PainkillerTooltip should display brand when available", () => {
    // Check that the tooltip renders brand info
    expect(chartCode).toContain("data.painkillerBrand");
  });

  it("PainkillerTooltip should display dosage when available", () => {
    // Check that the tooltip renders dosage info
    expect(chartCode).toContain("data.painkillerDosage");
  });

  it("PainkillerTooltip should show full date in tooltip", () => {
    expect(chartCode).toContain("fullDate");
    expect(chartCode).toContain("data.fullDate");
  });
});

describe("Chart Enhancement: Export to Image", () => {
  it("should import html2canvas dynamically", () => {
    expect(chartCode).toContain('import("html2canvas")');
  });

  it("should have a chartContainerRef for capturing", () => {
    expect(chartCode).toContain("chartContainerRef");
    expect(chartCode).toContain("useRef");
  });

  it("should have an export button with Download icon", () => {
    expect(chartCode).toContain("Download");
    expect(chartCode).toContain("handleExport");
  });

  it("should have exporting state for loading indicator", () => {
    expect(chartCode).toContain("exporting");
    expect(chartCode).toContain("setExporting");
  });

  it("should generate PNG with descriptive filename", () => {
    expect(chartCode).toContain(".png");
    expect(chartCode).toContain("toDataURL");
  });

  it("should show toast on successful export", () => {
    expect(chartCode).toContain("toast.success");
  });

  it("should show toast on export failure", () => {
    expect(chartCode).toContain("toast.error");
  });

  it("should use sonner toast (not react-hot-toast)", () => {
    expect(chartCode).toContain('from "sonner"');
    expect(chartCode).not.toContain("react-hot-toast");
  });

  it("should wrap exportable content in a ref container", () => {
    expect(chartCode).toContain("ref={chartContainerRef}");
  });
});

describe("Chart Enhancement: Data Filtering (regression)", () => {
  it("should filter headache chart data to only include dates with headache attacks", () => {
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

  it("should compute summary stats from ALL daily data", () => {
    expect(chartCode).toContain("const attackDays = dailyData.filter((d) => d.headacheLevel > 0).length");
    expect(chartCode).toContain("const painkillerDays = dailyData.filter((d) => d.painkillerTaken).length");
  });
});
