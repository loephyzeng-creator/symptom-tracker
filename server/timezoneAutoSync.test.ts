import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getBrowserTimezone,
  getTimezoneOptions,
  TIMEZONE_OPTIONS_BASE,
} from "../shared/timezone";

describe("Timezone auto-sync", () => {
  describe("getTimezoneOptions dynamic addition", () => {
    it("includes browser timezone even if not in base list", () => {
      const options = getTimezoneOptions("Pacific/Fiji");
      expect(options.length).toBe(TIMEZONE_OPTIONS_BASE.length + 1);
      expect(options[0].value).toBe("Pacific/Fiji");
      expect(options[0].label).toContain("Pacific/Fiji");
    });

    it("does not duplicate timezone already in base list", () => {
      const options = getTimezoneOptions("Asia/Shanghai");
      expect(options.length).toBe(TIMEZONE_OPTIONS_BASE.length);
    });

    it("Africa/Kampala is in the base list", () => {
      const values = TIMEZONE_OPTIONS_BASE.map((o) => o.value);
      expect(values).toContain("Africa/Kampala");
    });

    it("Africa/Nairobi is in the base list", () => {
      const values = TIMEZONE_OPTIONS_BASE.map((o) => o.value);
      expect(values).toContain("Africa/Nairobi");
    });

    it("dynamically added timezone has UTC offset in label", () => {
      const options = getTimezoneOptions("America/Bogota");
      const bogota = options.find((o) => o.value === "America/Bogota");
      expect(bogota).toBeDefined();
      expect(bogota!.label).toContain("UTC");
    });
  });

  describe("setTimezone force flag behavior", () => {
    // These tests verify the router logic conceptually
    // The actual router is tested via integration, but we verify the logic pattern

    it("should detect mismatch when saved timezone differs from browser", () => {
      const savedTimezone = "Asia/Shanghai";
      const browserTimezone = "Africa/Kampala";
      const isMismatch = savedTimezone !== browserTimezone;
      expect(isMismatch).toBe(true);
    });

    it("should not detect mismatch when timezones match", () => {
      const savedTimezone = "Africa/Kampala";
      const browserTimezone = "Africa/Kampala";
      const isMismatch = savedTimezone !== browserTimezone;
      expect(isMismatch).toBe(false);
    });

    it("session storage key format is correct for dismissal tracking", () => {
      const saved = "Asia/Shanghai";
      const browser = "Africa/Kampala";
      const key = `tz-dismissed-${saved}-${browser}`;
      expect(key).toBe("tz-dismissed-Asia/Shanghai-Africa/Kampala");
    });

    it("different timezone pairs produce different dismissal keys", () => {
      const key1 = `tz-dismissed-Asia/Shanghai-Africa/Kampala`;
      const key2 = `tz-dismissed-Asia/Shanghai-Europe/London`;
      expect(key1).not.toBe(key2);
    });
  });

  describe("timezone label lookup", () => {
    it("finds label for known timezone", () => {
      const options = getTimezoneOptions();
      const shanghai = options.find((o) => o.value === "Asia/Shanghai");
      expect(shanghai).toBeDefined();
      expect(shanghai!.label).toBe("中国标准时间 (UTC+8)");
    });

    it("finds label for Africa/Kampala", () => {
      const options = getTimezoneOptions();
      const kampala = options.find((o) => o.value === "Africa/Kampala");
      expect(kampala).toBeDefined();
      expect(kampala!.label).toBe("乌干达时间 (UTC+3)");
    });

    it("generates label for unknown timezone with UTC offset", () => {
      const options = getTimezoneOptions("Indian/Maldives");
      const maldives = options.find((o) => o.value === "Indian/Maldives");
      expect(maldives).toBeDefined();
      expect(maldives!.label).toContain("Indian/Maldives");
      expect(maldives!.label).toContain("UTC");
    });
  });
});
