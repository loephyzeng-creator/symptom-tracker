/**
 * Tests for calendar enhancement features:
 * 1. Day detail panel shows headache attack level and painkiller status
 * 2. Monthly painkiller usage summary (frontend computed from calendar data)
 * 3. Long-press to toggle painkiller status (uses entries.togglePainkiller mutation)
 */
import { describe, it, expect, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { getDb } from "./db";
import { symptomEntries } from "../drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";

describe("Calendar Enhancement Features", () => {
  describe("Feature 1: Day Detail with Headache & Painkiller Data", () => {
    it("should have medReminders.dayDetail query procedure", () => {
      expect(appRouter._def.procedures).toHaveProperty("medReminders.dayDetail");
    });

    it("getMedicationCheckInDayDetail should return headacheAttack and painkillerTaken fields", async () => {
      // The function should return an object with headacheAttack and painkillerTaken
      const result = await db.getMedicationCheckInDayDetail(999999, "2026-01-01");
      expect(result).toHaveProperty("headacheAttack");
      expect(result).toHaveProperty("painkillerTaken");
      expect(result).toHaveProperty("taken");
      expect(result).toHaveProperty("missed");
    });

    it("headacheAttack should default to 0 when no entry exists", async () => {
      const result = await db.getMedicationCheckInDayDetail(999999, "2026-01-01");
      expect(result.headacheAttack).toBe(0);
    });

    it("painkillerTaken should default to false when no entry exists", async () => {
      const result = await db.getMedicationCheckInDayDetail(999999, "2026-01-01");
      expect(result.painkillerTaken).toBe(false);
    });
  });

  describe("Feature 2: Monthly Painkiller Summary (Calendar Data)", () => {
    it("should have medReminders.checkInCalendar query procedure", () => {
      expect(appRouter._def.procedures).toHaveProperty("medReminders.checkInCalendar");
    });

    it("getMedicationCheckInCalendar should return days with painkillerTaken field", async () => {
      const result = await db.getMedicationCheckInCalendar(999999, 2026, 1);
      expect(result).toHaveProperty("days");
      expect(Array.isArray(result.days)).toBe(true);
      // Each day should have painkillerTaken field
      if (result.days.length > 0) {
        expect(result.days[0]).toHaveProperty("painkillerTaken");
        expect(typeof result.days[0].painkillerTaken).toBe("boolean");
      }
    });

    it("should return streak and monthlyRate in calendar data", async () => {
      const result = await db.getMedicationCheckInCalendar(999999, 2026, 1);
      expect(result).toHaveProperty("streak");
      expect(result).toHaveProperty("monthlyRate");
      expect(result).toHaveProperty("totalScheduled");
      expect(result).toHaveProperty("totalCompleted");
    });
  });

  describe("Feature 3: Quick Toggle Painkiller (Long-press)", () => {
    // Use unique user IDs and dates to avoid cross-test contamination
    const TOGGLE_USER = 888801;
    const TOGGLE_DATE = "2098-06-15";
    const DETAIL_USER = 888802;
    const DETAIL_DATE = "2098-06-16";

    afterAll(async () => {
      // Clean up test data to prevent flaky tests on re-runs
      const database = await getDb();
      if (database) {
        await database.delete(symptomEntries).where(
          and(
            inArray(symptomEntries.userId, [TOGGLE_USER, DETAIL_USER]),
            inArray(symptomEntries.date, [TOGGLE_DATE, DETAIL_DATE])
          )
        );
      }
    });

    it("should have entries.togglePainkiller mutation procedure", () => {
      expect(appRouter._def.procedures).toHaveProperty("entries.togglePainkiller");
    });

    it("togglePainkillerForDate should be exported from db module", () => {
      expect(typeof db.togglePainkillerForDate).toBe("function");
    });

    it("togglePainkillerForDate should toggle painkiller for a new date", async () => {
      // First toggle should set painkillerTaken to true (creates entry)
      const result1 = await db.togglePainkillerForDate(TOGGLE_USER, TOGGLE_DATE);
      expect(result1).toBe(true);

      // Second toggle should set painkillerTaken to false
      const result2 = await db.togglePainkillerForDate(TOGGLE_USER, TOGGLE_DATE);
      expect(result2).toBe(false);

      // Third toggle should set it back to true
      const result3 = await db.togglePainkillerForDate(TOGGLE_USER, TOGGLE_DATE);
      expect(result3).toBe(true);
    });

    it("togglePainkillerForDate should reflect in day detail", async () => {
      // After toggling to true, dayDetail should show painkillerTaken = true
      await db.togglePainkillerForDate(DETAIL_USER, DETAIL_DATE);
      const detail = await db.getMedicationCheckInDayDetail(DETAIL_USER, DETAIL_DATE);
      expect(detail.painkillerTaken).toBe(true);

      // Toggle back to false
      await db.togglePainkillerForDate(DETAIL_USER, DETAIL_DATE);
      const detail2 = await db.getMedicationCheckInDayDetail(DETAIL_USER, DETAIL_DATE);
      expect(detail2.painkillerTaken).toBe(false);
    });
  });
});
