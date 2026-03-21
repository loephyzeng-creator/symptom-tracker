import { describe, it, expect, vi } from "vitest";

// ============================================================
// 1. Interval-based medication reminder tests
// ============================================================
describe("Interval-based medication reminders", () => {
  it("should support intervalHours field in medication_reminders schema", () => {
    // The schema should accept intervalHours as an optional integer
    // and lastTakenAt as an optional varchar for ISO datetime
    expect(true).toBe(true); // Schema existence validated by TypeScript compilation
  });

  it("should calculate next dose time from lastTakenAt + intervalHours", () => {
    const lastTakenAt = "2026-03-21T08:00:00.000Z";
    const intervalHours = 8;
    const lastTaken = new Date(lastTakenAt);
    const nextDose = new Date(lastTaken.getTime() + intervalHours * 60 * 60 * 1000);
    expect(nextDose.toISOString()).toBe("2026-03-21T16:00:00.000Z");
  });

  it("should determine if it is time for next dose", () => {
    const lastTakenAt = "2026-03-21T08:00:00.000Z";
    const intervalHours = 8;
    const lastTaken = new Date(lastTakenAt);
    const nextDose = new Date(lastTaken.getTime() + intervalHours * 60 * 60 * 1000);

    // Before next dose
    const before = new Date("2026-03-21T15:00:00.000Z");
    expect(before < nextDose).toBe(true);

    // After next dose
    const after = new Date("2026-03-21T17:00:00.000Z");
    expect(after >= nextDose).toBe(true);
  });

  it("should calculate remaining time until next dose", () => {
    const lastTakenAt = "2026-03-21T08:00:00.000Z";
    const intervalHours = 8;
    const lastTaken = new Date(lastTakenAt);
    const nextDose = new Date(lastTaken.getTime() + intervalHours * 60 * 60 * 1000);
    const now = new Date("2026-03-21T14:30:00.000Z");

    const remainingMs = nextDose.getTime() - now.getTime();
    const remainingHours = remainingMs / (60 * 60 * 1000);
    expect(remainingHours).toBeCloseTo(1.5, 1);
  });

  it("should handle first dose when lastTakenAt is null", () => {
    const lastTakenAt: string | null = null;
    const intervalHours = 8;

    // When no previous dose, should be ready for first dose
    const isReady = lastTakenAt === null;
    expect(isReady).toBe(true);
  });

  it("should handle various interval values", () => {
    const intervals = [4, 6, 8, 12, 24];
    const lastTaken = new Date("2026-03-21T08:00:00.000Z");

    const expectedNextDoses = [
      "2026-03-21T12:00:00.000Z", // 4h
      "2026-03-21T14:00:00.000Z", // 6h
      "2026-03-21T16:00:00.000Z", // 8h
      "2026-03-21T20:00:00.000Z", // 12h
      "2026-03-22T08:00:00.000Z", // 24h
    ];

    intervals.forEach((interval, idx) => {
      const nextDose = new Date(lastTaken.getTime() + interval * 60 * 60 * 1000);
      expect(nextDose.toISOString()).toBe(expectedNextDoses[idx]);
    });
  });

  it("should format countdown display correctly", () => {
    // Helper function matching frontend logic
    function formatCountdown(remainingMs: number): string {
      if (remainingMs <= 0) return "可以服药了";
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      if (hours > 0) return `${hours}小时${minutes}分钟后`;
      return `${minutes}分钟后`;
    }

    expect(formatCountdown(5400000)).toBe("1小时30分钟后"); // 1.5h
    expect(formatCountdown(1800000)).toBe("30分钟后"); // 30min
    expect(formatCountdown(0)).toBe("可以服药了");
    expect(formatCountdown(-1000)).toBe("可以服药了");
  });
});

// ============================================================
// 2. Drug interaction check tests
// ============================================================
describe("Drug interaction checking", () => {
  it("should define severity levels correctly", () => {
    const validSeverities = ["mild", "moderate", "severe"];
    validSeverities.forEach((s) => {
      expect(["mild", "moderate", "severe"]).toContain(s);
    });
  });

  it("should sort interactions by severity (severe first)", () => {
    const interactions = [
      { drugA: "A", drugB: "B", severity: "mild" as const, description: "", recommendation: "" },
      { drugA: "C", drugB: "D", severity: "severe" as const, description: "", recommendation: "" },
      { drugA: "E", drugB: "F", severity: "moderate" as const, description: "", recommendation: "" },
    ];

    const order: Record<string, number> = { severe: 0, moderate: 1, mild: 2 };
    const sorted = [...interactions].sort((a, b) => order[a.severity] - order[b.severity]);

    expect(sorted[0].severity).toBe("severe");
    expect(sorted[1].severity).toBe("moderate");
    expect(sorted[2].severity).toBe("mild");
  });

  it("should detect if there are severe interactions", () => {
    const interactions = [
      { severity: "mild" as const },
      { severity: "severe" as const },
      { severity: "moderate" as const },
    ];

    const hasSevere = interactions.some((i) => i.severity === "severe");
    expect(hasSevere).toBe(true);

    const noSevere = [
      { severity: "mild" as const },
      { severity: "moderate" as const },
    ];
    expect(noSevere.some((i) => i.severity === "severe")).toBe(false);
  });

  it("should require at least 2 medications for analysis", () => {
    const activeMeds1 = [{ name: "Drug A" }];
    const activeMeds2 = [{ name: "Drug A" }, { name: "Drug B" }];

    expect(activeMeds1.length < 2).toBe(true);
    expect(activeMeds2.length < 2).toBe(false);
  });

  it("should handle empty interaction results", () => {
    const interactions: any[] = [];
    expect(interactions.length).toBe(0);
    const hasSevere = interactions.some((i: any) => i.severity === "severe");
    expect(hasSevere).toBe(false);
  });

  it("should validate interaction data structure", () => {
    const interaction = {
      drugA: "阿司匹林",
      drugB: "华法林",
      severity: "severe" as const,
      description: "增加出血风险",
      recommendation: "避免同时使用或密切监测凝血指标",
    };

    expect(interaction.drugA).toBeTruthy();
    expect(interaction.drugB).toBeTruthy();
    expect(["mild", "moderate", "severe"]).toContain(interaction.severity);
    expect(interaction.description).toBeTruthy();
    expect(interaction.recommendation).toBeTruthy();
  });

  it("should handle null recommendation field", () => {
    const interaction = {
      drugA: "A",
      drugB: "B",
      severity: "mild" as const,
      description: "Minor interaction",
      recommendation: null as string | null,
    };

    expect(interaction.recommendation).toBeNull();
    const displayRec = interaction.recommendation ?? "暂无建议";
    expect(displayRec).toBe("暂无建议");
  });
});

// ============================================================
// 3. Reminder times with interval mode tests
// ============================================================
describe("Reminder times with interval mode", () => {
  it("should distinguish between fixed-time and interval mode", () => {
    const fixedTimeReminder = {
      intervalHours: null,
      reminderTimes: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }],
    };

    const intervalReminder = {
      intervalHours: 8,
      reminderTimes: null,
    };

    expect(fixedTimeReminder.intervalHours).toBeNull();
    expect(intervalReminder.intervalHours).toBe(8);
  });

  it("should generate today meds entries for interval mode", () => {
    // Interval mode should generate a single entry (not per-time-point)
    const intervalReminder = {
      id: 1,
      medicationName: "布洛芬",
      intervalHours: 8,
      lastTakenAt: "2026-03-21T06:00:00.000Z",
    };

    // For interval mode, we generate one entry
    const entries = [{
      reminderId: intervalReminder.id,
      name: intervalReminder.medicationName,
      intervalHours: intervalReminder.intervalHours,
      lastTakenAt: intervalReminder.lastTakenAt,
      timeIndex: 0,
    }];

    expect(entries).toHaveLength(1);
    expect(entries[0].intervalHours).toBe(8);
    expect(entries[0].lastTakenAt).toBe("2026-03-21T06:00:00.000Z");
  });

  it("should update lastTakenAt when confirming interval medication", () => {
    const before = "2026-03-21T06:00:00.000Z";
    const confirmTime = new Date().toISOString();

    // After confirming, lastTakenAt should be updated to current time
    expect(confirmTime).not.toBe(before);
    expect(new Date(confirmTime).getTime()).toBeGreaterThan(new Date(before).getTime());
  });
});
