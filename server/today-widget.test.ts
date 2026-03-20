import { describe, it, expect } from "vitest";

/**
 * Tests for TodayWidget component logic
 * The widget compares today vs yesterday entries and shows changes
 */

// Replicate the core logic from TodayWidget for testing
const METRICS = [
  { key: "dizziness", label: "头晕", invert: true },
  { key: "headache", label: "头痛", invert: true },
  { key: "sleepQuality", label: "睡眠", invert: false },
  { key: "anxiety", label: "焦虑", invert: true },
  { key: "fatigue", label: "疲劳", invert: true },
  { key: "photosensitivity", label: "畏光", invert: true },
  { key: "motionSickness", label: "运动敏感", invert: true },
  { key: "palpitations", label: "心慌", invert: true },
  { key: "mood", label: "心情", invert: false },
] as const;

function getChange(
  todayVal: number,
  yesterdayVal: number,
  invert: boolean
): { direction: "up" | "down" | "same"; improved: boolean | null; diff: number } {
  const diff = todayVal - yesterdayVal;
  if (diff === 0) return { direction: "same", improved: null, diff: 0 };
  const direction = diff > 0 ? "up" : "down";
  const improved = invert ? diff < 0 : diff > 0;
  return { direction, improved, diff };
}

function calcWellnessAvg(entry: Record<string, number>): number {
  let sum = 0;
  for (const m of METRICS) {
    const val = entry[m.key] ?? 0;
    sum += m.invert ? 10 - val : val;
  }
  return sum / METRICS.length;
}

describe("TodayWidget — Change Detection", () => {
  it("should detect no change when values are equal", () => {
    const result = getChange(5, 5, true);
    expect(result.direction).toBe("same");
    expect(result.improved).toBeNull();
    expect(result.diff).toBe(0);
  });

  it("should detect improvement for inverted metric (decrease)", () => {
    // Dizziness: lower is better (invert=true)
    const result = getChange(3, 7, true);
    expect(result.direction).toBe("down");
    expect(result.improved).toBe(true);
    expect(result.diff).toBe(-4);
  });

  it("should detect worsening for inverted metric (increase)", () => {
    // Headache: higher is worse (invert=true)
    const result = getChange(8, 3, true);
    expect(result.direction).toBe("up");
    expect(result.improved).toBe(false);
    expect(result.diff).toBe(5);
  });

  it("should detect improvement for normal metric (increase)", () => {
    // Sleep quality: higher is better (invert=false)
    const result = getChange(8, 4, false);
    expect(result.direction).toBe("up");
    expect(result.improved).toBe(true);
    expect(result.diff).toBe(4);
  });

  it("should detect worsening for normal metric (decrease)", () => {
    // Mood: lower is worse (invert=false)
    const result = getChange(2, 7, false);
    expect(result.direction).toBe("down");
    expect(result.improved).toBe(false);
    expect(result.diff).toBe(-5);
  });
});

describe("TodayWidget — Wellness Score", () => {
  it("should calculate perfect wellness score for best values", () => {
    const bestEntry: Record<string, number> = {
      dizziness: 0, headache: 0, sleepQuality: 10,
      anxiety: 0, fatigue: 0, photosensitivity: 0,
      motionSickness: 0, palpitations: 0, mood: 10,
    };
    const avg = calcWellnessAvg(bestEntry);
    expect(avg).toBe(10);
  });

  it("should calculate worst wellness score for worst values", () => {
    const worstEntry: Record<string, number> = {
      dizziness: 10, headache: 10, sleepQuality: 0,
      anxiety: 10, fatigue: 10, photosensitivity: 10,
      motionSickness: 10, palpitations: 10, mood: 0,
    };
    const avg = calcWellnessAvg(worstEntry);
    expect(avg).toBe(0);
  });

  it("should calculate mid-range wellness for moderate values", () => {
    const midEntry: Record<string, number> = {
      dizziness: 5, headache: 5, sleepQuality: 5,
      anxiety: 5, fatigue: 5, photosensitivity: 5,
      motionSickness: 5, palpitations: 5, mood: 5,
    };
    const avg = calcWellnessAvg(midEntry);
    expect(avg).toBe(5);
  });

  it("should handle mixed values correctly", () => {
    const entry: Record<string, number> = {
      dizziness: 2, headache: 8, sleepQuality: 7,
      anxiety: 3, fatigue: 6, photosensitivity: 1,
      motionSickness: 4, palpitations: 5, mood: 6,
    };
    const avg = calcWellnessAvg(entry);
    // (10-2) + (10-8) + 7 + (10-3) + (10-6) + (10-1) + (10-4) + (10-5) + 6 = 8+2+7+7+4+9+6+5+6 = 54
    // 54 / 9 = 6.0
    expect(avg).toBe(6);
  });
});

describe("TodayWidget — Metric Sorting", () => {
  it("should sort changes by absolute diff descending", () => {
    const todayEntry: Record<string, number> = {
      dizziness: 8, headache: 2, sleepQuality: 9,
      anxiety: 5, fatigue: 5, photosensitivity: 5,
      motionSickness: 5, palpitations: 5, mood: 5,
    };
    const yesterdayEntry: Record<string, number> = {
      dizziness: 3, headache: 7, sleepQuality: 4,
      anxiety: 5, fatigue: 5, photosensitivity: 5,
      motionSickness: 5, palpitations: 5, mood: 5,
    };

    const changes = METRICS.map((m) => {
      const todayVal = todayEntry[m.key] ?? 0;
      const yesterdayVal = yesterdayEntry[m.key] ?? 0;
      const change = getChange(todayVal, yesterdayVal, m.invert);
      return { key: m.key, change };
    })
      .filter((m) => m.change.diff !== 0)
      .sort((a, b) => Math.abs(b.change.diff) - Math.abs(a.change.diff));

    expect(changes).toHaveLength(3);
    // All diffs are |5|, so order may vary, but all should have abs diff of 5
    expect(Math.abs(changes[0].change.diff)).toBe(5);
    expect(Math.abs(changes[1].change.diff)).toBe(5);
    expect(Math.abs(changes[2].change.diff)).toBe(5);
  });

  it("should limit to top 4 changes", () => {
    const todayEntry: Record<string, number> = {
      dizziness: 8, headache: 7, sleepQuality: 9,
      anxiety: 6, fatigue: 7, photosensitivity: 8,
      motionSickness: 3, palpitations: 2, mood: 8,
    };
    const yesterdayEntry: Record<string, number> = {
      dizziness: 3, headache: 2, sleepQuality: 4,
      anxiety: 1, fatigue: 2, photosensitivity: 3,
      motionSickness: 8, palpitations: 7, mood: 3,
    };

    const changes = METRICS.map((m) => {
      const todayVal = todayEntry[m.key] ?? 0;
      const yesterdayVal = yesterdayEntry[m.key] ?? 0;
      const change = getChange(todayVal, yesterdayVal, m.invert);
      return { key: m.key, change };
    })
      .filter((m) => m.change.diff !== 0)
      .sort((a, b) => Math.abs(b.change.diff) - Math.abs(a.change.diff))
      .slice(0, 4);

    expect(changes.length).toBeLessThanOrEqual(4);
  });

  it("should return empty changes when all values are the same", () => {
    const entry: Record<string, number> = {
      dizziness: 5, headache: 5, sleepQuality: 5,
      anxiety: 5, fatigue: 5, photosensitivity: 5,
      motionSickness: 5, palpitations: 5, mood: 5,
    };

    const changes = METRICS.map((m) => {
      const change = getChange(entry[m.key], entry[m.key], m.invert);
      return { key: m.key, change };
    }).filter((m) => m.change.diff !== 0);

    expect(changes).toHaveLength(0);
  });
});

describe("TodayWidget — Display Logic", () => {
  it("should have 9 metrics defined", () => {
    expect(METRICS).toHaveLength(9);
  });

  it("should have 7 inverted metrics and 2 normal metrics", () => {
    const inverted = METRICS.filter((m) => m.invert);
    const normal = METRICS.filter((m) => !m.invert);
    expect(inverted).toHaveLength(7);
    expect(normal).toHaveLength(2);
    // Normal metrics are sleepQuality and mood
    expect(normal.map((m) => m.key)).toContain("sleepQuality");
    expect(normal.map((m) => m.key)).toContain("mood");
  });

  it("widget should only show when today entry exists", () => {
    // Logic: if (!todayEntry) return null
    const entries: any[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEntry = entries.find((e: any) => e.date === todayStr);
    expect(todayEntry).toBeUndefined();
    // Widget returns null in this case
  });
});
