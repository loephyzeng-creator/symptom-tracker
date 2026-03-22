import { describe, it, expect } from "vitest";
import {
  getDateStrInTimezone,
  getTimeInTimezone,
  getDateTimeStrInTimezone,
  getLocalDateStr,
  getBrowserTimezone,
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
} from "../shared/timezone";

describe("Timezone utilities", () => {
  describe("getDateStrInTimezone", () => {
    it("returns a YYYY-MM-DD formatted string", () => {
      const result = getDateStrInTimezone("Asia/Shanghai");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns correct date for Asia/Shanghai timezone", () => {
      // 2026-01-15 00:30 UTC = 2026-01-15 08:30 in Asia/Shanghai
      const utcDate = new Date("2026-01-15T00:30:00Z");
      const result = getDateStrInTimezone("Asia/Shanghai", utcDate);
      expect(result).toBe("2026-01-15");
    });

    it("returns correct date for America/New_York timezone (UTC-5 in winter)", () => {
      // 2026-01-15 03:00 UTC = 2026-01-14 22:00 in America/New_York (EST, UTC-5)
      const utcDate = new Date("2026-01-15T03:00:00Z");
      const result = getDateStrInTimezone("America/New_York", utcDate);
      expect(result).toBe("2026-01-14");
    });

    it("handles date boundary correctly across timezones", () => {
      // 2026-03-20 20:00 UTC = 2026-03-21 04:00 in Asia/Shanghai
      const utcDate = new Date("2026-03-20T20:00:00Z");
      const shanghaiResult = getDateStrInTimezone("Asia/Shanghai", utcDate);
      expect(shanghaiResult).toBe("2026-03-21");

      // Same time in America/New_York = 2026-03-20 16:00 (EDT, UTC-4 in March)
      const nyResult = getDateStrInTimezone("America/New_York", utcDate);
      expect(nyResult).toBe("2026-03-20");
    });

    it("falls back gracefully for invalid timezone", () => {
      const result = getDateStrInTimezone("Invalid/Timezone");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getTimeInTimezone", () => {
    it("returns hour, minute, and dayOfWeek", () => {
      const result = getTimeInTimezone("Asia/Shanghai");
      expect(result).toHaveProperty("hour");
      expect(result).toHaveProperty("minute");
      expect(result).toHaveProperty("dayOfWeek");
      expect(result.hour).toBeGreaterThanOrEqual(0);
      expect(result.hour).toBeLessThanOrEqual(23);
      expect(result.minute).toBeGreaterThanOrEqual(0);
      expect(result.minute).toBeLessThanOrEqual(59);
      expect(result.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(result.dayOfWeek).toBeLessThanOrEqual(6);
    });

    it("returns correct time for a known UTC timestamp in Asia/Shanghai", () => {
      // 2026-01-15 02:30 UTC = 2026-01-15 10:30 in Asia/Shanghai (Thursday)
      const utcDate = new Date("2026-01-15T02:30:00Z");
      const result = getTimeInTimezone("Asia/Shanghai", utcDate);
      expect(result.hour).toBe(10);
      expect(result.minute).toBe(30);
      expect(result.dayOfWeek).toBe(4); // Thursday
    });

    it("returns correct time for America/Los_Angeles", () => {
      // 2026-01-15 20:45 UTC = 2026-01-15 12:45 in America/Los_Angeles (PST, UTC-8)
      const utcDate = new Date("2026-01-15T20:45:00Z");
      const result = getTimeInTimezone("America/Los_Angeles", utcDate);
      expect(result.hour).toBe(12);
      expect(result.minute).toBe(45);
    });

    it("handles day-of-week boundary correctly", () => {
      // 2026-01-18 23:00 UTC = 2026-01-19 07:00 in Asia/Shanghai
      // Jan 18 is Sunday (0), Jan 19 is Monday (1)
      const utcDate = new Date("2026-01-18T23:00:00Z");
      const shanghaiResult = getTimeInTimezone("Asia/Shanghai", utcDate);
      expect(shanghaiResult.dayOfWeek).toBe(1); // Monday in Shanghai

      const nyResult = getTimeInTimezone("America/New_York", utcDate);
      expect(nyResult.dayOfWeek).toBe(0); // Still Sunday in New York
    });
  });

  describe("getDateTimeStrInTimezone", () => {
    it("returns YYYY-MM-DD HH:mm format", () => {
      const result = getDateTimeStrInTimezone("Asia/Shanghai");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("returns correct datetime for a known timestamp", () => {
      const utcDate = new Date("2026-06-15T14:30:00Z");
      // Asia/Shanghai = UTC+8, so 14:30 UTC = 22:30 Shanghai
      const result = getDateTimeStrInTimezone("Asia/Shanghai", utcDate);
      expect(result).toBe("2026-06-15 22:30");
    });
  });

  describe("getLocalDateStr", () => {
    it("returns YYYY-MM-DD format", () => {
      const result = getLocalDateStr();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("uses local date parts correctly", () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026 in local time
      const result = getLocalDateStr(d);
      expect(result).toBe("2026-01-05");
    });

    it("pads single-digit months and days", () => {
      const d = new Date(2026, 2, 3); // Mar 3, 2026
      const result = getLocalDateStr(d);
      expect(result).toBe("2026-03-03");
    });
  });

  describe("DEFAULT_TIMEZONE", () => {
    it("is Asia/Shanghai", () => {
      expect(DEFAULT_TIMEZONE).toBe("Asia/Shanghai");
    });
  });

  describe("TIMEZONE_OPTIONS", () => {
    it("contains common timezones", () => {
      expect(TIMEZONE_OPTIONS.length).toBeGreaterThan(10);
      const values = TIMEZONE_OPTIONS.map((o) => o.value);
      expect(values).toContain("Asia/Shanghai");
      expect(values).toContain("America/New_York");
      expect(values).toContain("Europe/London");
      expect(values).toContain("America/Los_Angeles");
    });

    it("each option has value and label", () => {
      for (const opt of TIMEZONE_OPTIONS) {
        expect(opt.value).toBeTruthy();
        expect(opt.label).toBeTruthy();
      }
    });
  });
});
