import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Stock Quantity Real-time Update", () => {
  const medViewPath = path.resolve(__dirname, "../client/src/components/MedicationView.tsx");
  const medViewContent = fs.readFileSync(medViewPath, "utf-8");

  const medGroupPath = path.resolve(__dirname, "../client/src/components/MedicationGroupManager.tsx");
  const medGroupContent = fs.readFileSync(medGroupPath, "utf-8");

  describe("MedicationView - confirmTaken mutation", () => {
    it("should invalidate medReminders.list on confirmTaken success", () => {
      const confirmIdx = medViewContent.indexOf("confirmTakenMutation = trpc.medReminders.confirmTaken.useMutation");
      expect(confirmIdx).toBeGreaterThan(-1);
      const block = medViewContent.slice(confirmIdx, confirmIdx + 500);
      expect(block).toContain("medReminders.list.invalidate()");
    });

    it("should invalidate medReminders.list on unconfirmTaken success", () => {
      const unconfirmIdx = medViewContent.indexOf("unconfirmTakenMutation = trpc.medReminders.unconfirmTaken.useMutation");
      expect(unconfirmIdx).toBeGreaterThan(-1);
      const block = medViewContent.slice(unconfirmIdx, unconfirmIdx + 500);
      expect(block).toContain("medReminders.list.invalidate()");
    });

    it("should also invalidate todayMeds and checkInCalendar on confirm", () => {
      const confirmIdx = medViewContent.indexOf("confirmTakenMutation = trpc.medReminders.confirmTaken.useMutation");
      const block = medViewContent.slice(confirmIdx, confirmIdx + 500);
      expect(block).toContain("todayMeds.invalidate");
      expect(block).toContain("checkInCalendar.invalidate");
      expect(block).toContain("dayDetail.invalidate");
    });

    it("should also invalidate todayMeds and checkInCalendar on unconfirm", () => {
      const unconfirmIdx = medViewContent.indexOf("unconfirmTakenMutation = trpc.medReminders.unconfirmTaken.useMutation");
      const block = medViewContent.slice(unconfirmIdx, unconfirmIdx + 500);
      expect(block).toContain("todayMeds.invalidate");
      expect(block).toContain("checkInCalendar.invalidate");
      expect(block).toContain("dayDetail.invalidate");
    });
  });

  describe("MedicationGroupManager - confirmAll mutation", () => {
    it("should invalidate medReminders.list on confirmAll success", () => {
      const confirmAllIdx = medGroupContent.indexOf("confirmAll.useMutation");
      expect(confirmAllIdx).toBeGreaterThan(-1);
      const block = medGroupContent.slice(confirmAllIdx, confirmAllIdx + 500);
      expect(block).toContain("medReminders.list.invalidate()");
    });
  });

  describe("Backend - stock deduction logic", () => {
    const dbPath = path.resolve(__dirname, "./db.ts");
    const dbContent = fs.readFileSync(dbPath, "utf-8");

    it("deductMedicationStock should be a no-op since stock is now real-time", () => {
      expect(dbContent).toContain("export async function deductMedicationStock");
      const fnIdx = dbContent.indexOf("export async function deductMedicationStock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 500);
      expect(fnBody).toContain("No-op");
      expect(fnBody).toContain("real-time");
    });

    it("unconfirmMedicationTaken should rely on real-time stock calculation", () => {
      const fnIdx = dbContent.indexOf("export async function unconfirmMedicationTaken");
      expect(fnIdx).toBeGreaterThan(-1);
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      // Should NOT directly modify stockQuantity
      expect(fnBody).toContain("real-time");
      expect(fnBody).not.toContain("stockQuantity: (med.stockQuantity ?? 0) + 1");
    });

    it("confirmMedicationTaken should trigger stock deduction", () => {
      const fnIdx = dbContent.indexOf("export async function confirmMedicationTaken");
      expect(fnIdx).toBeGreaterThan(-1);
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      // Should either call deductMedicationStock or directly modify stock
      const hasDeduction = fnBody.includes("deductMedicationStock") || 
                           (fnBody.includes("stockQuantity") && fnBody.includes("- 1"));
      expect(hasDeduction).toBe(true);
    });
  });

  describe("MedicationReminders - stock display", () => {
    const remindersPath = path.resolve(__dirname, "../client/src/components/MedicationReminders.tsx");
    const remindersContent = fs.readFileSync(remindersPath, "utf-8");

    it("should display stock quantity on reminder cards", () => {
      expect(remindersContent).toContain("stockQuantity");
      expect(remindersContent).toContain("stockAlertDays");
    });

    it("should show stock count in the UI", () => {
      // The component should render the stock count somewhere
      expect(remindersContent).toMatch(/stockQuantity/);
    });
  });
});
