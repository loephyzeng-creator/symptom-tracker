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

    it("MedicationStock should show legacy data banner when hasRestockRecords is false", () => {
      expect(stockContent).toContain("hasRestockRecords");
      expect(stockContent).toContain("旧数据模式");
    });

    it("MedicationStock should show initialization button for legacy items", () => {
      expect(stockContent).toContain("初始化库存记录");
      expect(stockContent).toContain("PackagePlus");
    });

    it("MedicationStock initialization should pre-fill current stock quantity", () => {
      expect(stockContent).toContain("item.stockQuantity || 30");
    });

    it("MedicationStock should explain the legacy mode to users", () => {
      expect(stockContent).toContain("当前库存基于初始设置值推算");
      expect(stockContent).toContain("建议通过");
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
      expect(stockContent).toContain("stockChangeLog");
    });

    it("StockChangeLogPanel should show timeline with restock and usage events", () => {
      expect(stockContent).toContain("库存变化日志");
      expect(stockContent).toContain("ArrowUp");
      expect(stockContent).toContain("ArrowDown");
    });

    it("StockChangeLogPanel should display running total for each event", () => {
      expect(stockContent).toContain("event.runningTotal");
      expect(stockContent).toContain("余");
    });

    it("StockChangeLogPanel should use different colors for restock vs usage", () => {
      expect(stockContent).toContain("bg-sage/20");
      expect(stockContent).toContain("bg-terracotta/15");
      expect(stockContent).toContain("text-sage");
      expect(stockContent).toContain("text-terracotta");
    });

    it("StockChangeLogPanel should handle loading and empty states", () => {
      expect(stockContent).toContain("加载中");
      expect(stockContent).toContain("暂无库存变化记录");
    });

    it("MedicationStock should replace old restockHistory with StockChangeLogPanel", () => {
      // Old pattern should be gone
      expect(stockContent).not.toContain("restockHistory.map");
      // New pattern should be present
      expect(stockContent).toContain("<StockChangeLogPanel");
    });
  });
});
