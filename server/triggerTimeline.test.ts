/**
 * Tests for the trigger timeline analysis logic.
 * We test the pure computation functions that power the TriggerTimelineAnalysis component.
 */
import { describe, expect, it } from "vitest";

// Replicate the core analysis logic from the component for testing
interface MockEntry {
  date: string;
  dizziness: number;
  headache: number;
  sleepQuality: number;
  anxiety: number;
  fatigue: number;
  mood: number;
  triggers: string[];
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

const TRACKED_SYMPTOMS = [
  { key: "dizziness", label: "头晕" },
  { key: "headache", label: "头痛" },
  { key: "fatigue", label: "疲劳" },
  { key: "anxiety", label: "焦虑" },
  { key: "sleepQuality", label: "睡眠" },
  { key: "mood", label: "心情" },
];

function analyzeTimeline(entries: MockEntry[], trigger: string) {
  if (entries.length < 5) return null;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const dateMap = new Map<string, MockEntry>();
  sorted.forEach((e) => dateMap.set(e.date, e));

  const triggerDates = sorted
    .filter((e) => e.triggers.includes(trigger))
    .map((e) => e.date);

  if (triggerDates.length < 1) return null;

  // Group trigger dates into episodes (gap > 3 days = new episode)
  const episodes: { startDate: string; triggerDates: string[] }[] = [];
  let currentEpisode: string[] = [];

  triggerDates.forEach((date) => {
    if (currentEpisode.length === 0) {
      currentEpisode = [date];
    } else {
      const lastDate = currentEpisode[currentEpisode.length - 1];
      if (dayDiff(lastDate, date) <= 3) {
        currentEpisode.push(date);
      } else {
        episodes.push({ startDate: currentEpisode[0], triggerDates: [...currentEpisode] });
        currentEpisode = [date];
      }
    }
  });
  if (currentEpisode.length > 0) {
    episodes.push({ startDate: currentEpisode[0], triggerDates: [...currentEpisode] });
  }

  const MAX_TRACK_DAYS = 7;
  const processedEpisodes: any[] = [];

  episodes.forEach((ep) => {
    const startDate = ep.startDate;
    const dailyData: any[] = [];

    for (let d = 0; d <= MAX_TRACK_DAYS; d++) {
      const targetDate = new Date(parseDate(startDate));
      targetDate.setDate(targetDate.getDate() + d);
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

      const entry = dateMap.get(dateStr);
      if (entry) {
        const row: any = { day: d, date: dateStr };
        TRACKED_SYMPTOMS.forEach((s) => {
          row[s.key] = (entry as any)[s.key] ?? 0;
        });
        row.hasTrigger = entry.triggers.includes(trigger) ? 1 : 0;
        dailyData.push(row);
      }
    }

    if (dailyData.length >= 2) {
      let peakDay = 0;
      let peakVal = 0;
      dailyData.forEach((d: any) => {
        if (d.dizziness > peakVal) {
          peakVal = d.dizziness;
          peakDay = d.day;
        }
      });

      const baselineEntries = sorted.filter((e) => !e.triggers.includes(trigger));
      const baselineDizziness =
        baselineEntries.length > 0
          ? baselineEntries.reduce((s, e) => s + e.dizziness, 0) / baselineEntries.length
          : 3;

      let recoveryDay: number | null = null;
      for (let i = 0; i < dailyData.length; i++) {
        const d = dailyData[i];
        if (d.day > peakDay && d.dizziness <= baselineDizziness + 0.5) {
          recoveryDay = d.day;
          break;
        }
      }

      processedEpisodes.push({
        startDate,
        endDate: dailyData[dailyData.length - 1].date,
        durationDays: dailyData.length,
        peakDay,
        recoveryDay,
        dailyData,
      });
    }
  });

  if (processedEpisodes.length < 1) return null;

  // Aggregate
  const aggregated: any[] = [];
  for (let d = 0; d <= MAX_TRACK_DAYS; d++) {
    const row: any = { day: d };
    TRACKED_SYMPTOMS.forEach((s) => {
      const values = processedEpisodes
        .map((ep: any) => ep.dailyData.find((dd: any) => dd.day === d))
        .filter(Boolean)
        .map((dd: any) => dd[s.key] as number);
      row[s.key] = values.length > 0 ? Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 10) / 10 : null;
    });
    row.sampleCount = processedEpisodes.filter((ep: any) => ep.dailyData.some((dd: any) => dd.day === d)).length;
    if (row.sampleCount > 0) aggregated.push(row);
  }

  const baselineEntries = sorted.filter((e) => !e.triggers.includes(trigger));
  const baseline: Record<string, number> = {};
  TRACKED_SYMPTOMS.forEach((s) => {
    baseline[s.key] =
      baselineEntries.length > 0
        ? Math.round(
            (baselineEntries.reduce((sum, e) => sum + ((e as any)[s.key] ?? 0), 0) / baselineEntries.length) * 10
          ) / 10
        : 0;
  });

  const recoveredEpisodes = processedEpisodes.filter((ep: any) => ep.recoveryDay !== null);
  const avgRecoveryDays =
    recoveredEpisodes.length > 0
      ? Math.round(
          (recoveredEpisodes.reduce((s: number, ep: any) => s + ep.recoveryDay, 0) / recoveredEpisodes.length) * 10
        ) / 10
      : null;

  const avgPeakDay =
    processedEpisodes.length > 0
      ? Math.round(
          (processedEpisodes.reduce((s: number, ep: any) => s + ep.peakDay, 0) / processedEpisodes.length) * 10
        ) / 10
      : 0;

  return {
    episodes: processedEpisodes,
    aggregated,
    baseline,
    avgRecoveryDays,
    avgPeakDay,
    totalEpisodes: processedEpisodes.length,
    recoveredCount: recoveredEpisodes.length,
  };
}

// Helper to generate test entries
function makeEntry(date: string, overrides: Partial<MockEntry> = {}): MockEntry {
  return {
    date,
    dizziness: 2,
    headache: 1,
    sleepQuality: 6,
    anxiety: 2,
    fatigue: 3,
    mood: 6,
    triggers: [],
    ...overrides,
  };
}

describe("TriggerTimelineAnalysis logic", () => {
  it("returns null when fewer than 5 entries", () => {
    const entries = [
      makeEntry("2025-03-01", { triggers: ["上火"], dizziness: 7 }),
      makeEntry("2025-03-02", { dizziness: 5 }),
      makeEntry("2025-03-03", { dizziness: 3 }),
    ];
    expect(analyzeTimeline(entries, "上火")).toBeNull();
  });

  it("returns null when no trigger entries exist", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`2025-03-${String(i + 1).padStart(2, "0")}`)
    );
    expect(analyzeTimeline(entries, "上火")).toBeNull();
  });

  it("detects a single trigger episode with peak and recovery", () => {
    const entries = [
      // Baseline days
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      makeEntry("2025-03-03", { dizziness: 3 }),
      // Trigger day (D+0)
      makeEntry("2025-03-04", { triggers: ["上火"], dizziness: 5 }),
      // D+1: peak
      makeEntry("2025-03-05", { dizziness: 8 }),
      // D+2: still high
      makeEntry("2025-03-06", { dizziness: 6 }),
      // D+3: recovering
      makeEntry("2025-03-07", { dizziness: 3 }),
      // D+4: back to baseline
      makeEntry("2025-03-08", { dizziness: 2 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    expect(result!.totalEpisodes).toBe(1);
    expect(result!.episodes[0].peakDay).toBe(1); // D+1 is the peak
    expect(result!.episodes[0].recoveryDay).toBe(3); // D+3 is recovery
    expect(result!.avgPeakDay).toBe(1);
    expect(result!.avgRecoveryDays).toBe(3);
    expect(result!.recoveredCount).toBe(1);
  });

  it("groups consecutive trigger days into one episode", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      // Two consecutive trigger days
      makeEntry("2025-03-03", { triggers: ["上火"], dizziness: 5 }),
      makeEntry("2025-03-04", { triggers: ["上火"], dizziness: 7 }),
      makeEntry("2025-03-05", { dizziness: 4 }),
      makeEntry("2025-03-06", { dizziness: 2 }),
      makeEntry("2025-03-07", { dizziness: 2 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    expect(result!.totalEpisodes).toBe(1); // Grouped into 1 episode
    expect(result!.episodes[0].startDate).toBe("2025-03-03");
  });

  it("separates episodes with gap > 3 days", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      // Episode 1
      makeEntry("2025-03-03", { triggers: ["上火"], dizziness: 6 }),
      makeEntry("2025-03-04", { dizziness: 4 }),
      makeEntry("2025-03-05", { dizziness: 2 }),
      // Gap
      makeEntry("2025-03-06", { dizziness: 2 }),
      makeEntry("2025-03-07", { dizziness: 2 }),
      makeEntry("2025-03-08", { dizziness: 2 }),
      makeEntry("2025-03-09", { dizziness: 2 }),
      // Episode 2
      makeEntry("2025-03-10", { triggers: ["上火"], dizziness: 7 }),
      makeEntry("2025-03-11", { dizziness: 5 }),
      makeEntry("2025-03-12", { dizziness: 2 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    expect(result!.totalEpisodes).toBe(2);
    expect(result!.episodes[0].startDate).toBe("2025-03-03");
    expect(result!.episodes[1].startDate).toBe("2025-03-10");
  });

  it("calculates correct baseline from non-trigger days", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 4 }),
      makeEntry("2025-03-03", { dizziness: 3 }),
      makeEntry("2025-03-04", { triggers: ["上火"], dizziness: 7 }),
      makeEntry("2025-03-05", { dizziness: 5 }),
      makeEntry("2025-03-06", { dizziness: 3 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    // Baseline = avg of non-trigger days: (2+4+3+5+3)/5 = 3.4
    expect(result!.baseline.dizziness).toBe(3.4);
  });

  it("produces aggregated data with correct day labels", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      makeEntry("2025-03-03", { triggers: ["上火"], dizziness: 6 }),
      makeEntry("2025-03-04", { dizziness: 8 }),
      makeEntry("2025-03-05", { dizziness: 4 }),
      makeEntry("2025-03-06", { dizziness: 2 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    expect(result!.aggregated.length).toBeGreaterThanOrEqual(2);
    expect(result!.aggregated[0].day).toBe(0); // D+0
    expect(result!.aggregated[0].dizziness).toBe(6); // Trigger day value
  });

  it("handles episode where symptoms don't recover within tracking window", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      makeEntry("2025-03-03", { triggers: ["上火"], dizziness: 6 }),
      makeEntry("2025-03-04", { dizziness: 7 }),
      makeEntry("2025-03-05", { dizziness: 7 }),
      makeEntry("2025-03-06", { dizziness: 6 }),
      makeEntry("2025-03-07", { dizziness: 6 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    expect(result!.episodes[0].recoveryDay).toBeNull();
    expect(result!.recoveredCount).toBe(0);
    expect(result!.avgRecoveryDays).toBeNull();
  });

  it("averages across multiple episodes correctly", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      // Episode 1: peak at D+1, recovery at D+2
      makeEntry("2025-03-03", { triggers: ["上火"], dizziness: 5 }),
      makeEntry("2025-03-04", { dizziness: 7 }),
      makeEntry("2025-03-05", { dizziness: 2 }),
      // Gap
      makeEntry("2025-03-10", { dizziness: 2 }),
      makeEntry("2025-03-11", { dizziness: 2 }),
      // Episode 2: peak at D+1, recovery at D+4
      makeEntry("2025-03-15", { triggers: ["上火"], dizziness: 6 }),
      makeEntry("2025-03-16", { dizziness: 8 }),
      makeEntry("2025-03-17", { dizziness: 6 }),
      makeEntry("2025-03-18", { dizziness: 4 }),
      makeEntry("2025-03-19", { dizziness: 2 }),
    ];

    const result = analyzeTimeline(entries, "上火");
    expect(result).not.toBeNull();
    expect(result!.totalEpisodes).toBe(2);
    // Both episodes peak at D+1
    expect(result!.avgPeakDay).toBe(1);
    // Episode 1 recovers at D+2, Episode 2 recovers at D+3 → avg = 2.5
    expect(result!.avgRecoveryDays).toBe(2.5);
  });

  it("works with different trigger names", () => {
    const entries = [
      makeEntry("2025-03-01", { dizziness: 2 }),
      makeEntry("2025-03-02", { dizziness: 2 }),
      makeEntry("2025-03-03", { triggers: ["睡眠不足"], dizziness: 5 }),
      makeEntry("2025-03-04", { dizziness: 7 }),
      makeEntry("2025-03-05", { dizziness: 3 }),
      makeEntry("2025-03-06", { dizziness: 2 }),
    ];

    const result = analyzeTimeline(entries, "睡眠不足");
    expect(result).not.toBeNull();
    expect(result!.totalEpisodes).toBe(1);
  });
});
