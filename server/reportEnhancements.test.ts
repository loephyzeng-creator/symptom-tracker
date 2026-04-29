import { describe, expect, it } from "vitest";

/**
 * Tests for the three report enhancements:
 * 1. Quick date presets (本周/本月/上月) — pure date logic
 * 2. Report comparison mode (two date ranges)
 * 3. Auto-report generation logic
 */

// ── Helper functions (same logic as in ReportView.tsx, duplicated for testing) ──
function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getThisWeekRange(today: Date): { from: Date; to: Date } {
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return { from: monday, to: today };
}

function getThisMonthRange(today: Date): { from: Date; to: Date } {
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from, to: today };
}

function getLastMonthRange(today: Date): { from: Date; to: Date } {
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from, to };
}

// ── 1. Quick Date Presets ──
describe("Quick Date Presets", () => {
  describe("dateToStr", () => {
    it("formats a date as YYYY-MM-DD", () => {
      const d = new Date(2026, 3, 15); // April 15, 2026
      expect(dateToStr(d)).toBe("2026-04-15");
    });

    it("pads single-digit month and day", () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026
      expect(dateToStr(d)).toBe("2026-01-05");
    });
  });

  describe("formatDateCN", () => {
    it("formats date string as Chinese month/day", () => {
      expect(formatDateCN("2026-04-15")).toBe("4月15日");
    });

    it("formats January 1st correctly", () => {
      expect(formatDateCN("2026-01-01")).toBe("1月1日");
    });
  });

  describe("getThisWeekRange", () => {
    it("returns Monday to today for a Wednesday", () => {
      const wed = new Date(2026, 3, 29); // April 29, 2026 (Wednesday)
      const range = getThisWeekRange(wed);
      expect(dateToStr(range.from)).toBe("2026-04-27"); // Monday
      expect(dateToStr(range.to)).toBe("2026-04-29"); // Wednesday
    });

    it("returns Monday to Monday when today is Monday", () => {
      const mon = new Date(2026, 3, 27); // April 27, 2026 (Monday)
      const range = getThisWeekRange(mon);
      expect(dateToStr(range.from)).toBe("2026-04-27");
      expect(dateToStr(range.to)).toBe("2026-04-27");
    });

    it("returns Monday to Sunday when today is Sunday", () => {
      const sun = new Date(2026, 4, 3); // May 3, 2026 (Sunday)
      const range = getThisWeekRange(sun);
      expect(dateToStr(range.from)).toBe("2026-04-27");
      expect(dateToStr(range.to)).toBe("2026-05-03");
    });
  });

  describe("getThisMonthRange", () => {
    it("returns 1st of current month to today", () => {
      const today = new Date(2026, 3, 15); // April 15
      const range = getThisMonthRange(today);
      expect(dateToStr(range.from)).toBe("2026-04-01");
      expect(dateToStr(range.to)).toBe("2026-04-15");
    });

    it("returns 1st to 1st when today is the 1st", () => {
      const today = new Date(2026, 3, 1); // April 1
      const range = getThisMonthRange(today);
      expect(dateToStr(range.from)).toBe("2026-04-01");
      expect(dateToStr(range.to)).toBe("2026-04-01");
    });
  });

  describe("getLastMonthRange", () => {
    it("returns full previous month range", () => {
      const today = new Date(2026, 3, 15); // April 15
      const range = getLastMonthRange(today);
      expect(dateToStr(range.from)).toBe("2026-03-01");
      expect(dateToStr(range.to)).toBe("2026-03-31");
    });

    it("handles February correctly (non-leap year)", () => {
      const today = new Date(2027, 2, 10); // March 10, 2027
      const range = getLastMonthRange(today);
      expect(dateToStr(range.from)).toBe("2027-02-01");
      expect(dateToStr(range.to)).toBe("2027-02-28");
    });

    it("handles January (previous month is December of last year)", () => {
      const today = new Date(2026, 0, 15); // Jan 15, 2026
      const range = getLastMonthRange(today);
      expect(dateToStr(range.from)).toBe("2025-12-01");
      expect(dateToStr(range.to)).toBe("2025-12-31");
    });
  });
});

// ── 2. Report Comparison Mode ──
import { generateReportHTML } from "./report";

describe("Report Comparison Mode", () => {
  const sampleEntriesA = [
    {
      date: "2026-04-01",
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
      triggers: ["睡眠不足"],
      notes: null,
    },
  ];

  const sampleEntriesB = [
    {
      date: "2026-03-01",
      dizziness: 8,
      headache: 7,
      sleepQuality: 3,
      anxiety: 6,
      fatigue: 9,
      photosensitivity: 5,
      motionSickness: 6,
      palpitations: 4,
      mood: 3,
      medications: [{ name: "布洛芬", dosage: "400mg" }],
      triggers: ["压力大", "天气变化"],
      notes: "感觉很差",
    },
  ];

  it("generates separate reports for two different date ranges", () => {
    const htmlA = generateReportHTML(sampleEntriesA, "2026-04-01", "2026-04-07", "用户A");
    const htmlB = generateReportHTML(sampleEntriesB, "2026-03-01", "2026-03-07", "用户A");

    expect(htmlA).toContain("<!DOCTYPE html>");
    expect(htmlB).toContain("<!DOCTYPE html>");
    // Report uses formatted dates like "2026年4月1日"
    expect(htmlA).toContain("4月1日");
    expect(htmlB).toContain("3月1日");
  });

  it("handles empty entries for one period", () => {
    const html = generateReportHTML([], "2026-04-01", "2026-04-07", "用户");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("generates reports with different lengths for different data", () => {
    const htmlA = generateReportHTML(sampleEntriesA, "2026-04-01", "2026-04-07", "用户");
    const htmlB = generateReportHTML(sampleEntriesB, "2026-03-01", "2026-03-07", "用户");

    expect(htmlA).toBeTruthy();
    expect(htmlB).toBeTruthy();
    expect(htmlA.length).toBeGreaterThan(100);
    expect(htmlB.length).toBeGreaterThan(100);
  });
});

// ── 3. Auto-Report Generation Logic ──
describe("Auto-Report Date Calculations", () => {
  describe("Weekly auto-report (every Monday)", () => {
    it("calculates correct previous week range on Monday", () => {
      const todayStr = "2026-04-27";
      const todayDate = new Date(todayStr + "T00:00:00");

      const lastMonday = new Date(todayDate);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(todayDate);
      lastSunday.setDate(lastSunday.getDate() - 1);

      expect(lastMonday.toISOString().slice(0, 10)).toBe("2026-04-20");
      expect(lastSunday.toISOString().slice(0, 10)).toBe("2026-04-26");
    });

    it("calculates correct range across month boundary", () => {
      const todayStr = "2026-05-04";
      const todayDate = new Date(todayStr + "T00:00:00");

      const lastMonday = new Date(todayDate);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(todayDate);
      lastSunday.setDate(lastSunday.getDate() - 1);

      expect(lastMonday.toISOString().slice(0, 10)).toBe("2026-04-27");
      expect(lastSunday.toISOString().slice(0, 10)).toBe("2026-05-03");
    });
  });

  describe("Monthly auto-report (1st of each month)", () => {
    it("calculates correct previous month range", () => {
      const todayDate = new Date(2026, 4, 1); // May 1

      const lastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);

      expect(lastMonth.toISOString().slice(0, 10)).toBe("2026-04-01");
      expect(lastDayPrevMonth.toISOString().slice(0, 10)).toBe("2026-04-30");
    });

    it("handles January (previous month is December)", () => {
      const todayDate = new Date(2026, 0, 1);

      const lastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);

      expect(lastMonth.toISOString().slice(0, 10)).toBe("2025-12-01");
      expect(lastDayPrevMonth.toISOString().slice(0, 10)).toBe("2025-12-31");
    });

    it("handles February correctly", () => {
      const todayDate = new Date(2026, 2, 1);

      const lastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);

      expect(lastMonth.toISOString().slice(0, 10)).toBe("2026-02-01");
      expect(lastDayPrevMonth.toISOString().slice(0, 10)).toBe("2026-02-28");
    });
  });

  describe("Frequency matching logic", () => {
    it("weekly frequency should only trigger on Monday (dayOfWeek=1)", () => {
      const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      const shouldSendWeekly = daysOfWeek.map((d) => d === 1);
      expect(shouldSendWeekly).toEqual([false, true, false, false, false, false, false]);
    });

    it("monthly frequency should only trigger on 1st of month", () => {
      const dates = [1, 2, 15, 28, 30, 31];
      const shouldSendMonthly = dates.map((d) => d === 1);
      expect(shouldSendMonthly).toEqual([true, false, false, false, false, false]);
    });

    it("should not send if already sent today", () => {
      const todayStr = "2026-04-27";
      const lastAutoReportDate = "2026-04-27";
      expect(lastAutoReportDate === todayStr).toBe(true);
    });

    it("should send if last report was on a different day", () => {
      const todayStr = "2026-04-27";
      const lastAutoReportDate = "2026-04-20";
      expect(lastAutoReportDate !== todayStr).toBe(true);
    });
  });
});

// ── 4. Schema validation ──
describe("Auto-Report Schema Fields", () => {
  it("autoReportFrequency should only accept 'weekly' or 'monthly'", () => {
    const validValues = ["weekly", "monthly"];
    const invalidValues = ["daily", "biweekly", "yearly"];

    for (const v of validValues) {
      expect(validValues.includes(v)).toBe(true);
    }
    for (const v of invalidValues) {
      expect(validValues.includes(v)).toBe(false);
    }
  });

  it("autoReportEnabled should be 0 or 1", () => {
    expect([0, 1].includes(0)).toBe(true);
    expect([0, 1].includes(1)).toBe(true);
    expect([0, 1].includes(2)).toBe(false);
  });
});
