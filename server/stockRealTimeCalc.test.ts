import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Real-Time Stock Calculation System", () => {
  const dbPath = path.resolve(__dirname, "./db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");

  const routersPath = path.resolve(__dirname, "./routers.ts");
  const routersContent = fs.readFileSync(routersPath, "utf-8");

  const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  const stockComponentPath = path.resolve(__dirname, "../client/src/components/MedicationStock.tsx");
  const stockComponentContent = fs.readFileSync(stockComponentPath, "utf-8");

  const remindersPath = path.resolve(__dirname, "../client/src/components/MedicationReminders.tsx");
  const remindersContent = fs.readFileSync(remindersPath, "utf-8");

  describe("Database Schema: medication_restocks table", () => {
    it("should have medicationRestocks table definition", () => {
      expect(schemaContent).toContain("medicationRestocks");
      expect(schemaContent).toContain("medication_restocks");
    });

    it("should have required columns: reminderId, restockQuantity, restockDate", () => {
      const tableIdx = schemaContent.indexOf("medication_restocks");
      const tableBlock = schemaContent.slice(tableIdx, tableIdx + 500);
      expect(tableBlock).toContain("reminderId");
      expect(tableBlock).toContain("restockQuantity");
      expect(tableBlock).toContain("restockDate");
    });

    it("should have userId column for ownership", () => {
      const tableIdx = schemaContent.indexOf("medication_restocks");
      const tableBlock = schemaContent.slice(tableIdx, tableIdx + 500);
      expect(tableBlock).toContain("userId");
    });

    it("should export types for MedicationRestock", () => {
      expect(schemaContent).toContain("export type MedicationRestock");
      expect(schemaContent).toContain("export type InsertMedicationRestock");
    });
  });

  describe("Backend: Real-time stock computation", () => {
    it("should have countMedicationUsageSince helper function", () => {
      expect(dbContent).toContain("async function countMedicationUsageSince");
    });

    it("countMedicationUsageSince should query symptom_entries since a date", () => {
      const fnIdx = dbContent.indexOf("async function countMedicationUsageSince");
      const fnEnd = dbContent.indexOf("\n/**", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      expect(fnBody).toContain("symptomEntries");
      expect(fnBody).toContain("gte(symptomEntries.date, sinceDate)");
    });

    it("should have getLatestRestock helper function", () => {
      expect(dbContent).toContain("async function getLatestRestock");
    });

    it("getLatestRestock should query medicationRestocks ordered by createdAt desc", () => {
      const fnIdx = dbContent.indexOf("async function getLatestRestock");
      const fnEnd = dbContent.indexOf("\n/**", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 500);
      expect(fnBody).toContain("medicationRestocks");
      expect(fnBody).toContain("desc(medicationRestocks.createdAt)");
      expect(fnBody).toContain("limit(1)");
    });

    it("should have computeRealTimeStock function", () => {
      expect(dbContent).toContain("export async function computeRealTimeStock");
    });

    it("should have getAllRestocks helper function", () => {
      expect(dbContent).toContain("async function getAllRestocks");
    });

    it("getAllRestocks should return all restock records ordered by restockDate", () => {
      const fnIdx = dbContent.indexOf("async function getAllRestocks");
      const fnEnd = dbContent.indexOf("\n/**", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 500);
      expect(fnBody).toContain("medicationRestocks");
      expect(fnBody).toContain("medicationRestocks.restockDate");
    });

    it("computeRealTimeStock should sum ALL restock quantities plus initial stock and subtract total usage", () => {
      const fnIdx = dbContent.indexOf("export async function computeRealTimeStock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      // Should sum all restocks, not just use the latest one
      expect(fnBody).toContain("totalRestocked");
      expect(fnBody).toContain(".reduce(");
      // Should include initial stock: initialStock + totalRestocked - totalUsage
      expect(fnBody).toContain("initialStock + totalRestocked - totalUsage");
      expect(fnBody).toContain("Math.max(0,");
      // initialStock should come from legacy stockQuantity
      expect(fnBody).toContain("const initialStock = reminder.stockQuantity ?? 0");
    });

    it("computeRealTimeStock should count usage since reminder creation date (baseDate)", () => {
      const fnIdx = dbContent.indexOf("export async function computeRealTimeStock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      // Should use baseDate (from reminder.createdAt) for both legacy and restock modes
      expect(fnBody).toContain("baseDate");
      expect(fnBody).toContain("countMedicationUsageSince");
    });

    it("computeRealTimeStock should deduct usage from legacy stockQuantity when no restock record", () => {
      const fnIdx = dbContent.indexOf("export async function computeRealTimeStock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1500);
      // Should still reference legacy stockQuantity
      expect(fnBody).toContain("reminder.stockQuantity");
      // But now it deducts usage in real-time even in legacy mode
      expect(fnBody).toContain("countMedicationUsageSince");
      expect(fnBody).toContain("reminder.stockQuantity - totalUsage");
    });

    it("getMedicationReminders should compute real-time stock for each reminder", () => {
      const fnIdx = dbContent.indexOf("export async function getMedicationReminders");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      expect(fnBody).toContain("computeRealTimeStock");
      expect(fnBody).toContain("stockQuantity: realStock");
    });

    it("getMedicationRemindersGrouped should compute real-time stock for each reminder", () => {
      const fnIdx = dbContent.indexOf("export async function getMedicationRemindersGrouped");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 2000);
      expect(fnBody).toContain("computeRealTimeStock");
      expect(fnBody).toContain("remindersWithStock");
    });

    it("getMedicationStockStatus should use computeRealTimeStock", () => {
      const fnIdx = dbContent.indexOf("export async function getMedicationStockStatus");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 2000);
      expect(fnBody).toContain("computeRealTimeStock");
      expect(fnBody).toContain("getLatestRestock");
    });

    it("getMedicationStockStatus should include restockDate in response", () => {
      const fnIdx = dbContent.indexOf("export async function getMedicationStockStatus");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 2000);
      expect(fnBody).toContain("restockDate: latestRestock?.restockDate");
    });

    it("deductMedicationStock should be a no-op now", () => {
      const fnIdx = dbContent.indexOf("export async function deductMedicationStock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 500);
      expect(fnBody).toContain("No-op");
      expect(fnBody).toContain("real-time");
    });

    it("unconfirmMedicationTaken should not directly modify stockQuantity", () => {
      const fnIdx = dbContent.indexOf("export async function unconfirmMedicationTaken");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      // Should NOT contain direct stock modification
      expect(fnBody).not.toContain("stockQuantity: (med.stockQuantity ?? 0) + 1");
      expect(fnBody).toContain("real-time");
    });
  });

  describe("Backend: Restock record management", () => {
    it("should have addMedicationRestock function", () => {
      expect(dbContent).toContain("export async function addMedicationRestock");
    });

    it("addMedicationRestock should accept userId, reminderId, restockQuantity, restockDate", () => {
      const fnIdx = dbContent.indexOf("export async function addMedicationRestock");
      const fnBlock = dbContent.slice(fnIdx, fnIdx + 300);
      expect(fnBlock).toContain("userId: number");
      expect(fnBlock).toContain("reminderId: number");
      expect(fnBlock).toContain("restockQuantity: number");
      expect(fnBlock).toContain("restockDate: string");
    });

    it("addMedicationRestock should insert into medicationRestocks", () => {
      const fnIdx = dbContent.indexOf("export async function addMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      expect(fnBody).toContain("db.insert(medicationRestocks)");
    });

    it("addMedicationRestock should verify reminder belongs to user", () => {
      const fnIdx = dbContent.indexOf("export async function addMedicationRestock");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      expect(fnBody).toContain("Reminder not found");
    });

    it("should have getRestockHistory function", () => {
      expect(dbContent).toContain("export async function getRestockHistory");
    });

    it("getRestockHistory should return records ordered by createdAt desc", () => {
      const fnIdx = dbContent.indexOf("export async function getRestockHistory");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 500);
      expect(fnBody).toContain("desc(medicationRestocks.createdAt)");
    });

    it("batchRestockMedications should accept restockDate parameter", () => {
      const fnIdx = dbContent.indexOf("export async function batchRestockMedications");
      const fnBlock = dbContent.slice(fnIdx, fnIdx + 300);
      expect(fnBlock).toContain("restockDate: string");
    });

    it("batchRestockMedications should call addMedicationRestock for each low-stock item", () => {
      const fnIdx = dbContent.indexOf("export async function batchRestockMedications");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 1000);
      expect(fnBody).toContain("addMedicationRestock");
    });
  });

  describe("API Endpoints", () => {
    it("should have restock endpoint in routers.ts", () => {
      expect(routersContent).toContain("restock:");
      expect(routersContent).toContain("addMedicationRestock");
    });

    it("restock endpoint should require reminderId, restockQuantity, restockDate", () => {
      const idx = routersContent.indexOf("restock: protectedProcedure");
      const block = routersContent.slice(idx, idx + 400);
      expect(block).toContain("reminderId: z.number()");
      expect(block).toContain("restockQuantity: z.number().min(1)");
      expect(block).toContain("restockDate: z.string().regex");
    });

    it("should have restockHistory endpoint in routers.ts", () => {
      expect(routersContent).toContain("restockHistory:");
      expect(routersContent).toContain("getRestockHistory");
    });

    it("batchRestock endpoint should require restockDate", () => {
      const idx = routersContent.indexOf("batchRestock:");
      const block = routersContent.slice(idx, idx + 400);
      expect(block).toContain("restockDate: z.string().regex");
    });
  });

  describe("Frontend: MedicationStock component", () => {
    it("should have restockDate state", () => {
      expect(stockComponentContent).toContain("restockDate");
      expect(stockComponentContent).toContain("setRestockDate");
    });

    it("should have restockQuantity state", () => {
      expect(stockComponentContent).toContain("restockQuantity");
      expect(stockComponentContent).toContain("setRestockQuantity");
    });

    it("should use trpc.medReminders.restock.useMutation", () => {
      expect(stockComponentContent).toContain("trpc.medReminders.restock.useMutation");
    });

    it("should use trpc.medReminders.restockHistory.useQuery", () => {
      expect(stockComponentContent).toContain("trpc.medReminders.restockHistory.useQuery");
    });

    it("should have date input for restock", () => {
      expect(stockComponentContent).toContain('type="date"');
      expect(stockComponentContent).toContain("补货日期");
    });

    it("should have quantity input for restock", () => {
      expect(stockComponentContent).toContain("补货数量");
    });

    it("should display restock date info on stock items", () => {
      expect(stockComponentContent).toContain("最近补货");
      expect(stockComponentContent).toContain("item.restockDate");
    });

    it("should have stock change log display", () => {
      expect(stockComponentContent).toContain("StockChangeLogPanel");
      // StockChangeLogPanel is now imported from a standalone component
      expect(stockComponentContent).toContain("import StockChangeLogPanel");
    });

    it("should use AnimatedNumber for stock display", () => {
      expect(stockComponentContent).toContain("AnimatedNumber");
      expect(stockComponentContent).toContain("value={item.stockQuantity}");
    });

    it("should explain that stock is computed from restock date", () => {
      expect(stockComponentContent).toContain("库存将从补货日期起");
    });
  });

  describe("Frontend: MedicationReminders batch restock", () => {
    it("should have restockDate state", () => {
      expect(remindersContent).toContain("restockDate");
      expect(remindersContent).toContain("setRestockDate");
    });

    it("batch restock mutation should pass restockDate", () => {
      expect(remindersContent).toContain("batchRestockMutation.mutate({ restockQuantity, restockDate })");
    });

    it("batch restock dialog should have date input", () => {
      // Check that the dialog has a date input
      const dialogIdx = remindersContent.indexOf("一键补货");
      expect(dialogIdx).toBeGreaterThan(-1);
      const dialogBlock = remindersContent.slice(dialogIdx, dialogIdx + 800);
      expect(dialogBlock).toContain('type="date"');
      expect(dialogBlock).toContain("补货日期");
    });

    it("batch restock dialog should explain stock counting from restock date", () => {
      const dialogIdx = remindersContent.indexOf("一键补货");
      const dialogBlock = remindersContent.slice(dialogIdx, dialogIdx + 500);
      expect(dialogBlock).toContain("补货日期开始计算");
    });
  });
});
