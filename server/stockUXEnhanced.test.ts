import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Stock UX Enhancements", () => {
  const dbPath = path.resolve(__dirname, "./db.ts");
  const dbContent = fs.readFileSync(dbPath, "utf-8");

  const routersPath = path.resolve(__dirname, "./routers.ts");
  const routersContent = fs.readFileSync(routersPath, "utf-8");

  const medViewPath = path.resolve(__dirname, "../client/src/components/MedicationView.tsx");
  const medViewContent = fs.readFileSync(medViewPath, "utf-8");

  const stockPath = path.resolve(__dirname, "../client/src/components/MedicationStock.tsx");
  const stockContent = fs.readFileSync(stockPath, "utf-8");

  const stockLogPanelPath = path.resolve(__dirname, "../client/src/components/StockChangeLogPanel.tsx");
  const stockLogPanelContent = fs.readFileSync(stockLogPanelPath, "utf-8");

  describe("Feature 1: Stock display on check-in buttons", () => {
    it("getTodayMedications should include stockQuantity in result type", () => {
      const fnIdx = dbContent.indexOf("export async function getTodayMedications");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("stockQuantity: number | null");
    });

    it("getTodayMedications should pre-compute real-time stock with cache", () => {
      const fnIdx = dbContent.indexOf("export async function getTodayMedications");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("stockCache");
      expect(fnBody).toContain("computeRealTimeStock");
    });

    it("getTodayMedications should pass stockQuantity from cache to each result item", () => {
      const fnIdx = dbContent.indexOf("export async function getTodayMedications");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("stockQuantity: stockCache.get(r.id)");
    });

    it("MedicationView should display stock quantity next to check-in buttons", () => {
      expect(medViewContent).toContain("stockQuantity");
      expect(medViewContent).toContain("余");
    });

    it("MedicationView should import Package and AlertTriangle icons for stock display", () => {
      expect(medViewContent).toContain("Package");
      expect(medViewContent).toContain("AlertTriangle");
    });

    it("MedicationView should show low-stock warning when stockQuantity <= 7", () => {
      expect(medViewContent).toContain("med.stockQuantity <= 7");
      expect(medViewContent).toContain("bg-red-100");
    });

    it("MedicationView should handle null stockQuantity gracefully", () => {
      expect(medViewContent).toContain("med.stockQuantity !== null");
      expect(medViewContent).toContain("med.stockQuantity !== undefined");
    });
  });

  describe("Feature 2: Stock initialization entry for legacy data", () => {
    it("getMedicationStockStatus should include hasRestockRecords field", () => {
      const fnIdx = dbContent.indexOf("export async function getMedicationStockStatus");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 2000);
      expect(fnBody).toContain("hasRestockRecords");
      expect(fnBody).toContain("latestRestock !== null");
    });

    it("MedicationStock should display stock information", () => {
      // Legacy data mode UI was removed; verify stock component still uses stock status API
      expect(stockContent).toContain("stockStatus");
    });
  });

  describe("Feature 3: Stock change log timeline", () => {
    it("should have getStockChangeLog function in db.ts", () => {
      expect(dbContent).toContain("export async function getStockChangeLog");
    });

    it("getStockChangeLog should accept userId and reminderId", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnBlock = dbContent.slice(fnIdx, fnIdx + 300);
      expect(fnBlock).toContain("userId: number");
      expect(fnBlock).toContain("reminderId: number");
    });

    it("getStockChangeLog should return events with type, date, quantity, runningTotal", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnBlock = dbContent.slice(fnIdx, fnIdx + 300);
      expect(fnBlock).toContain("type: 'restock' | 'usage'");
      expect(fnBlock).toContain("date: string");
      expect(fnBlock).toContain("quantity: number");
      expect(fnBlock).toContain("runningTotal?: number");
    });

    it("getStockChangeLog should query both restock records and symptom entries", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("medicationRestocks");
      expect(fnBody).toContain("symptomEntries");
    });

    it("getStockChangeLog should calculate running totals", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("runningTotal");
      // Should handle both restock (add) and usage (subtract)
      expect(fnBody).toContain("runningTotal +=");
      expect(fnBody).toContain("runningTotal - e.quantity");
    });

    it("getStockChangeLog should handle legacy mode (no restock records) with initial stockQuantity", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain("reminder.stockQuantity");
    });

    it("getStockChangeLog should return events sorted newest first", () => {
      const fnIdx = dbContent.indexOf("export async function getStockChangeLog");
      const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
      const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 3000);
      expect(fnBody).toContain(".reverse()");
    });

    it("should have stockChangeLog endpoint in routers.ts", () => {
      expect(routersContent).toContain("stockChangeLog:");
      expect(routersContent).toContain("getStockChangeLog");
    });

    it("stockChangeLog endpoint should require reminderId", () => {
      const idx = routersContent.indexOf("stockChangeLog:");
      const block = routersContent.slice(idx, idx + 300);
      expect(block).toContain("reminderId: z.number()");
    });

    it("MedicationStock should have StockChangeLogPanel component", () => {
      expect(stockContent).toContain("StockChangeLogPanel");
      expect(stockContent).toContain("import StockChangeLogPanel");
    });

    it("StockChangeLogPanel should show timeline with restock and usage events", () => {
      expect(stockLogPanelContent).toContain("库存变化日志");
      expect(stockLogPanelContent).toContain("ArrowUp");
      expect(stockLogPanelContent).toContain("ArrowDown");
    });

    it("StockChangeLogPanel should display running total for each event", () => {
      expect(stockLogPanelContent).toContain("event.runningTotal");
      expect(stockLogPanelContent).toContain("余");
    });

    it("StockChangeLogPanel should use different colors for restock vs usage", () => {
      expect(stockLogPanelContent).toContain("bg-sage/20");
      expect(stockLogPanelContent).toContain("bg-terracotta/15");
      expect(stockLogPanelContent).toContain("text-sage");
      expect(stockLogPanelContent).toContain("text-terracotta");
    });

    it("StockChangeLogPanel should handle loading and empty states", () => {
      expect(stockLogPanelContent).toContain("加载中");
      expect(stockLogPanelContent).toContain("暂无库存变化记录");
    });

    it("MedicationStock should replace old restockHistory with StockChangeLogPanel", () => {
      // Old pattern should be gone
      expect(stockContent).not.toContain("restockHistory.map");
      // New pattern should be present
      expect(stockContent).toContain("<StockChangeLogPanel");
    });
  });
});
