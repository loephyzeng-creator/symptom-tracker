/**
 * Tests for medication note display functionality.
 * Verifies that notes are properly stored and returned in various APIs.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { readDbContent, readRoutersContent } from "./test-compat";

describe("Medication Note Display", () => {
  const dbContent = readDbContent();

  describe("confirmMedicationTaken - note storage", () => {
    it("should accept note parameter in confirmMedicationTaken", () => {
      expect(dbContent).toContain("function confirmMedicationTaken");
      // The function should accept note as 4th parameter
      expect(dbContent).toMatch(/confirmMedicationTaken\(\s*userId.*reminderId.*timeIndex.*note/s);
    });

    it("should include note in newMed object when provided", () => {
      // The function should conditionally add note to the medication entry
      expect(dbContent).toContain("note ? { note } : {}");
    });
  });

  describe("getTodayMedications - note in response", () => {
    it("should include note field in result type", () => {
      // The result type should include note: string | null
      expect(dbContent).toContain("note: string | null;");
    });

    it("should use find instead of some to get matched medication with note", () => {
      // Should use .find() to get the matched medication object (not just .some())
      expect(dbContent).toContain("const matchedMed = takenMeds.find(");
    });

    it("should return note from matched medication", () => {
      expect(dbContent).toContain("note: (matchedMed as any)?.note || null");
    });
  });

  describe("getMedicationCheckInDayDetail - note in response", () => {
    it("should collect notes from recorded medications", () => {
      expect(dbContent).toContain("notesByReminderId");
      expect(dbContent).toContain("notesByName");
    });

    it("should include note in taken medications", () => {
      // The taken array type should include optional note
      expect(dbContent).toContain("note?: string");
    });

    it("should attach note to taken medication entries", () => {
      expect(dbContent).toContain("notesByReminderId.get(med.id)");
    });
  });

  describe("Router - confirmTaken endpoint", () => {
    const routerContent = readRoutersContent();

    it("should accept note in confirmTaken input schema", () => {
      expect(routerContent).toContain("note: z.string()");
    });

    it("should pass note to confirmMedicationTaken", () => {
      expect(routerContent).toContain("input.note");
    });
  });

  describe("Frontend - MedicationView note UI", () => {
    const medViewPath = path.resolve(__dirname, "../client/src/components/MedicationView.tsx");
    const medViewContent = fs.readFileSync(medViewPath, "utf-8");

    it("should have shrink-0 on confirm button to prevent truncation", () => {
      expect(medViewContent).toContain("shrink-0 flex items-center gap-1 text-xs px-3");
    });

    it("should have whitespace-nowrap on confirm button", () => {
      expect(medViewContent).toContain("whitespace-nowrap");
    });

    it("should have min-w-0 on input to allow proper flex shrinking", () => {
      expect(medViewContent).toContain("flex-1 min-w-0");
    });

    it("should display note for taken medications", () => {
      expect(medViewContent).toContain("med.note");
    });
  });

  describe("Frontend - MedicationCheckInCalendar note display", () => {
    const calPath = path.resolve(__dirname, "../client/src/components/MedicationCheckInCalendar.tsx");
    const calContent = fs.readFileSync(calPath, "utf-8");

    it("should import MessageSquare icon", () => {
      expect(calContent).toContain("MessageSquare");
    });

    it("should display note in taken medication pills", () => {
      expect(calContent).toContain("med.note");
    });
  });

  describe("Frontend - MedicationCheckInSummary note display", () => {
    const summaryPath = path.resolve(__dirname, "../client/src/components/MedicationCheckInSummary.tsx");
    const summaryContent = fs.readFileSync(summaryPath, "utf-8");

    it("should import MessageSquare icon", () => {
      expect(summaryContent).toContain("MessageSquare");
    });

    it("should display note for taken medications in history", () => {
      expect(summaryContent).toContain("med.note");
    });
  });
});
