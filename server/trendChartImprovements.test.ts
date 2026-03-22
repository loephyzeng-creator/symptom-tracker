import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const statsViewCode = readFileSync(
  path.resolve(__dirname, "../client/src/components/StatsView.tsx"),
  "utf-8"
);

describe("Trend Chart: Micro-offset for overlapping lines", () => {
  it("should detect overlapping values among active symptoms", () => {
    expect(statsViewCode).toContain("valueGroups");
    expect(statsViewCode).toContain("activeKeys");
  });

  it("should apply micro-offset when multiple lines share the same value", () => {
    expect(statsViewCode).toMatch(/keys\.length > 1/);
    expect(statsViewCode).toContain("0.08");
  });

  it("should store raw values for tooltip display", () => {
    expect(statsViewCode).toContain("_raw: rawValues");
  });

  it("should spread overlapping lines symmetrically around the center", () => {
    // mid = (keys.length - 1) / 2; adjusted = raw + (i - mid) * offset
    expect(statsViewCode).toContain("(keys.length - 1) / 2");
    expect(statsViewCode).toMatch(/\(i - mid\) \* 0\.08/);
  });
});

describe("Trend Chart: Legend", () => {
  it("should import Legend from recharts", () => {
    // Legend is in a multi-line import block
    expect(statsViewCode).toContain("Legend");
    expect(statsViewCode).toMatch(/Legend[\s\S]*from "recharts"/);
  });

  it("should render Legend component in the chart", () => {
    expect(statsViewCode).toContain("<Legend");
  });

  it("should use circle icon type for legend", () => {
    expect(statsViewCode).toContain('iconType="circle"');
  });

  it("should position legend at bottom", () => {
    expect(statsViewCode).toContain('verticalAlign="bottom"');
  });
});

describe("Trend Chart: Tooltip shows raw values", () => {
  it("should access raw data from payload for tooltip display", () => {
    expect(statsViewCode).toContain("payload[0]?.payload?._raw");
  });

  it("should display raw value instead of adjusted value in tooltip", () => {
    expect(statsViewCode).toContain("rawData ? rawData[p.dataKey] : p.value");
  });

  it("tooltip should show all active metrics with color indicators", () => {
    expect(statsViewCode).toContain("p.color");
    expect(statsViewCode).toContain("p.name");
  });
});
