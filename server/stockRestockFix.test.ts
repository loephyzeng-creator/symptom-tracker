import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Restock Fix & Undo Feature", () => {
  const dbPath = path.resolve(__dirname, "./db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");

  const routersPath = path.resolve(__dirname, "./routers.ts");
  const routersContent = fs.readFileSync(routersPath, "utf-8");

  const stockPath = path.resolve(__dirname, "../client/src/components/MedicationStock.tsx");
  const stockContent = fs.readFileSync(stockPath, "utf-8");

  const stockLogPanelPath = path.resolve(__dirname, "../client/src/components/StockChangeLogPanel.tsx");
  const stockLogPanelContent = fs.readFileSync(stockLogPanelPath, "utf-8");

  describe("Bug Fix: addMedicationRestock no longer overwrites stockQuantity", () => {
    it("addMedicationRestock should NOT update stockQuantity field", () => {
      const fnIdx = dbContent.indexOf("export async function addMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      // Should NOT contain .set({ stockQuantity: restockQuantity })
      expect(fnBody).not.toContain(".set({ stockQuantity: restockQuantity })");
      expect(fnBody).not.toContain("set({ stockQuantity:");
    });

    it("addMedicationRestock should have a comment explaining why stockQuantity is not updated", () => {
      const fnIdx = dbContent.indexOf("export async function addMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      expect(fnBody).toContain("Do NOT overwrite stockQuantity");
    });

    it("addMedicationRestock should still insert into medicationRestocks", () => {
      const fnIdx = dbContent.indexOf("export async function addMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      expect(fnBody).toContain("db.insert(medicationRestocks)");
    });

    it("computeRealTimeStock should sum ALL restock quantities (not just latest)", () => {
      const fnIdx = dbContent.indexOf("export async function computeRealTimeStock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      expect(fnBody).toContain("totalRestocked");
      expect(fnBody).toContain(".reduce(");
      expect(fnBody).toContain("totalRestocked - totalUsage");
    });
  });

  describe("Delete Restock Record API", () => {
    it("should have deleteMedicationRestock function in db.ts", () => {
      expect(dbContent).toContain("export async function deleteMedicationRestock");
    });

    it("deleteMedicationRestock should accept userId and restockId", () => {
      const fnIdx = dbContent.indexOf("export async function deleteMedicationRestock");
      const fnBlock = dbContent.slice(fnIdx, fnIdx + 300);
      expect(fnBlock).toContain("userId: number");
      expect(fnBlock).toContain("restockId: number");
    });

    it("deleteMedicationRestock should verify record belongs to user before deleting", () => {
      const fnIdx = dbContent.indexOf("export async function deleteMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      expect(fnBody).toContain("eq(medicationRestocks.userId, userId)");
      expect(fnBody).toContain("Restock record not found");
    });

    it("deleteMedicationRestock should delete the record", () => {
      const fnIdx = dbContent.indexOf("export async function deleteMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      // Check that the function performs a delete operation on medicationRestocks
      expect(fnBody).toContain(".delete(medicationRestocks)");
    });

    it("should have deleteRestock endpoint in routers.ts", () => {
      expect(routersContent).toContain("deleteRestock:");
      expect(routersContent).toContain("deleteMedicationRestock");
    });

    it("deleteRestock endpoint should require restockId", () => {
      const idx = routersContent.indexOf("deleteRestock:");
      const block = routersContent.slice(idx, idx + 300);
      expect(block).toContain("restockId: z.number()");
    });
  });

  describe("Stock Change Log includes restockId", () => {
    it("getStockChangeLog return type should include restockId", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnBlock = dbContent.slice(fnIdx, fnIdx + 400);
      expect(fnBlock).toContain("restockId?: number");
    });

    it("getStockChangeLog should attach restockId to restock events", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("restockId: r.id");
    });

    it("getStockChangeLog should include restockId in final output", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("restockId: e.restockId");
    });
  });

  describe("Frontend: Undo restock UI", () => {
    it("MedicationStock should import Undo2 icon", () => {
      expect(stockContent).toContain("Undo2");
    });

    it("StockChangeLogPanel should have deleteRestock mutation", () => {
      expect(stockLogPanelContent).toContain("deleteRestock.useMutation");
    });

    it("StockChangeLogPanel should show undo button for restock events", () => {
      expect(stockLogPanelContent).toContain("event.restockId");
      expect(stockLogPanelContent).toContain("撤销此次补货");
    });

    it("StockChangeLogPanel should have AlertDialog confirmation flow before deleting", () => {
      expect(stockLogPanelContent).toContain("undoTarget");
      expect(stockLogPanelContent).toContain("AlertDialog");
      expect(stockLogPanelContent).toContain("确认撤销");
      expect(stockLogPanelContent).toContain("取消");
    });

    it("StockChangeLogPanel should show success toast after deletion", () => {
      expect(stockLogPanelContent).toContain("已撤销补货记录");
    });

    it("StockChangeLogPanel should invalidate relevant queries after deletion", () => {
      expect(stockLogPanelContent).toContain("stockStatus.invalidate");
      expect(stockLogPanelContent).toContain("stockChangeLog.invalidate");
      expect(stockLogPanelContent).toContain("list.invalidate");
    });
  });
});
