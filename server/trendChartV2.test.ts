import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const statsViewCode = readFileSync(
  path.resolve(__dirname, "../client/src/components/StatsView.tsx"),
  "utf-8"
);

describe("Unique colors for each metric", () => {
  it("should have 9 unique colors in SYMPTOM_CONFIGS", () => {
    // Extract all color values from SYMPTOM_CONFIGS
    const colorMatches = statsViewCode.match(/color:\s*"(#[0-9a-fA-F]{6})"/g);
    expect(colorMatches).toBeTruthy();
    const colors = colorMatches!.map((m) => m.match(/#[0-9a-fA-F]{6}/)![0]);
    // There are 9 symptom configs
    expect(colors.length).toBe(9);
    // All should be unique
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(9);
  });

  it("motionSickness should not share color with dizziness", () => {
    const dizzinessColor = statsViewCode.match(
      /key:\s*"dizziness".*?color:\s*"(#[0-9a-fA-F]{6})"/
    );
    const motionColor = statsViewCode.match(
      /key:\s*"motionSickness".*?color:\s*"(#[0-9a-fA-F]{6})"/
    );
    expect(dizzinessColor).toBeTruthy();
    expect(motionColor).toBeTruthy();
    expect(dizzinessColor![1]).not.toBe(motionColor![1]);
  });

  it("palpitations should not share color with headache", () => {
    const headacheColor = statsViewCode.match(
      /key:\s*"headache".*?color:\s*"(#[0-9a-fA-F]{6})"/
    );
    const palpColor = statsViewCode.match(
      /key:\s*"palpitations".*?color:\s*"(#[0-9a-fA-F]{6})"/
    );
    expect(headacheColor).toBeTruthy();
    expect(palpColor).toBeTruthy();
    expect(headacheColor![1]).not.toBe(palpColor![1]);
  });

  it("mood should not share color with fatigue", () => {
    const fatigueColor = statsViewCode.match(
      /key:\s*"fatigue".*?color:\s*"(#[0-9a-fA-F]{6})"/
    );
    const moodColor = statsViewCode.match(
      /key:\s*"mood".*?color:\s*"(#[0-9a-fA-F]{6})"/
    );
    expect(fatigueColor).toBeTruthy();
    expect(moodColor).toBeTruthy();
    expect(fatigueColor![1]).not.toBe(moodColor![1]);
  });
});

describe("Pinch-to-zoom on mobile", () => {
  it("should have zoomDomain state", () => {
    expect(statsViewCode).toContain("zoomDomain");
    expect(statsViewCode).toContain("setZoomDomain");
  });

  it("should have touch event handlers", () => {
    expect(statsViewCode).toContain("handleTouchStart");
    expect(statsViewCode).toContain("handleTouchMove");
    expect(statsViewCode).toContain("handleTouchEnd");
  });

  it("should detect two-finger pinch gesture", () => {
    expect(statsViewCode).toContain("e.touches.length === 2");
    expect(statsViewCode).toContain("Math.sqrt");
  });

  it("should calculate zoom scale from pinch distance", () => {
    expect(statsViewCode).toContain("touchStartRef.current.dist");
    expect(statsViewCode).toContain("scale");
  });

  it("should have a reset zoom button", () => {
    expect(statsViewCode).toContain("resetZoom");
  });

  it("should apply touch-none class to prevent default scroll during pinch", () => {
    expect(statsViewCode).toContain("touch-none");
  });

  it("should slice chartData when zoomed", () => {
    expect(statsViewCode).toMatch(
      /zoomDomain\s*\?\s*chartData\.slice\(zoomDomain\.start/
    );
  });

  it("should enforce minimum zoom range of 2 data points", () => {
    expect(statsViewCode).toContain("Math.max(2,");
  });
});

describe("Baseline reference lines", () => {
  it("should import ReferenceLine from recharts", () => {
    expect(statsViewCode).toContain("ReferenceLine");
  });

  it("should have showBaseline toggle state", () => {
    expect(statsViewCode).toContain("showBaseline");
    expect(statsViewCode).toContain("setShowBaseline");
  });

  it("should render ReferenceLine components when showBaseline is true", () => {
    expect(statsViewCode).toContain("<ReferenceLine");
    expect(statsViewCode).toContain("showBaseline && averages");
  });

  it("should use dashed stroke for reference lines", () => {
    expect(statsViewCode).toMatch(/strokeDasharray="4 4"/);
  });

  it("should label reference lines with metric name and average value", () => {
    expect(statsViewCode).toMatch(/averages\[s\.key\]/);
  });

  it("should have a toggle button for baseline visibility", () => {
    expect(statsViewCode).toContain("setShowBaseline(!showBaseline)");
  });
});
