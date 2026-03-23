import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { readDbContent, readRoutersContent } from "./test-compat";

describe("Stock Management Enhancements", () => {
  const remindersPath = path.resolve(__dirname, "../client/src/components/MedicationReminders.tsx");
  const remindersContent = fs.readFileSync(remindersPath, "utf-8");
  const dbContent = readDbContent();
  const routersContent = readRoutersContent();

  const animatedNumberPath = path.resolve(__dirname, "../client/src/components/AnimatedNumber.tsx");
  const animatedNumberContent = fs.readFileSync(animatedNumberPath, "utf-8");

  describe("Feature 1: Low-stock card highlighting", () => {
    it("should have isLowStock helper function", () => {
      expect(remindersContent).toContain("isLowStock");
      expect(remindersContent).toContain("useCallback");
    });

    it("should apply red border class when stock is low", () => {
      expect(remindersContent).toContain("border-red-400");
      expect(remindersContent).toContain("dark:border-red-500");
    });

    it("should apply red background tint for low-stock cards", () => {
      expect(remindersContent).toContain("bg-red-50/50");
      expect(remindersContent).toContain("dark:bg-red-950/20");
    });

    it("should show '库存不足' label with AlertTriangle icon for low-stock items", () => {
      expect(remindersContent).toContain("库存不足");
      expect(remindersContent).toContain("AlertTriangle");
    });

    it("should use red pill icon for low-stock reminders", () => {
      expect(remindersContent).toContain('isLowStock(reminder) ? "text-red-500" : "text-terracotta"');
    });

    it("should show normal stock tag for non-low-stock items", () => {
      // Normal stock display should still exist
      expect(remindersContent).toContain("bg-muted/60 text-muted-foreground");
      expect(remindersContent).toMatch(/库存\s/);
    });

    it("should compute lowStockCount from reminders", () => {
      expect(remindersContent).toContain("lowStockCount");
      expect(remindersContent).toContain("useMemo");
    });

    it("isLowStock should compare remaining days against alertDays", () => {
      // The isLowStock function should calculate days remaining and compare
      const fnIdx = remindersContent.indexOf("const isLowStock = useCallback");
      expect(fnIdx).toBeGreaterThan(-1);
      const fnBlock = remindersContent.slice(fnIdx, fnIdx + 400);
      expect(fnBlock).toContain("dailyDosageCount");
      expect(fnBlock).toContain("stockAlertDays");
      expect(fnBlock).toContain("days <= alertDays");
    });
  });

  describe("Feature 2: Batch restock", () => {
    describe("Backend", () => {
      it("should have batchRestockMedications function in db.ts", () => {
        expect(dbContent).toContain("export async function batchRestockMedications");
      });

      it("batchRestockMedications should accept userId and restockQuantity", () => {
        const fnIdx = dbContent.indexOf("export async function batchRestockMedications");
        expect(fnIdx).toBeGreaterThan(-1);
        const fnBlock = dbContent.slice(fnIdx, fnIdx + 200);
        expect(fnBlock).toContain("userId: number");
        expect(fnBlock).toContain("restockQuantity: number");
      });

      it("batchRestockMedications should return restocked count and names", () => {
        const fnIdx = dbContent.indexOf("export async function batchRestockMedications");
        const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
        const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 2000);
        expect(fnBody).toContain("restocked");
        expect(fnBody).toContain("names");
        expect(fnBody).toContain("lowStockItems");
      });

      it("batchRestockMedications should only restock low-stock medications", () => {
        const fnIdx = dbContent.indexOf("export async function batchRestockMedications");
        const fnEnd = dbContent.indexOf("\nexport ", fnIdx + 10);
        const fnBody = dbContent.slice(fnIdx, fnEnd > -1 ? fnEnd : fnIdx + 2000);
        expect(fnBody).toContain("isLow");
        expect(fnBody).toContain("addMedicationRestock");
      });

      it("should have batchRestock endpoint in routers.ts", () => {
        expect(routersContent).toContain("batchRestock:");
        expect(routersContent).toContain("batchRestockMedications");
      });

      it("batchRestock endpoint should validate restockQuantity input", () => {
        const idx = routersContent.indexOf("batchRestock:");
        expect(idx).toBeGreaterThan(-1);
        const block = routersContent.slice(idx, idx + 300);
        expect(block).toContain("restockQuantity");
        expect(block).toContain("z.number().min(1)");
      });

      it("batchRestock should be a protected procedure", () => {
        const idx = routersContent.indexOf("batchRestock:");
        const block = routersContent.slice(idx, idx + 200);
        expect(block).toContain("protectedProcedure");
      });
    });

    describe("Frontend", () => {
      it("should have showRestockDialog state", () => {
        expect(remindersContent).toContain("showRestockDialog");
        expect(remindersContent).toContain("setShowRestockDialog");
      });

      it("should have restockQuantity state with default 30", () => {
        expect(remindersContent).toContain("restockQuantity");
        expect(remindersContent).toContain("setRestockQuantity");
        expect(remindersContent).toContain("useState(30)");
      });

      it("should have batchRestockMutation calling the API", () => {
        expect(remindersContent).toContain("batchRestockMutation");
        expect(remindersContent).toContain("trpc.medReminders.batchRestock.useMutation");
      });

      it("should show restock button only when lowStockCount > 0", () => {
        expect(remindersContent).toContain("lowStockCount > 0");
        expect(remindersContent).toContain("补货");
      });

      it("should have restock dialog with quantity input", () => {
        expect(remindersContent).toContain("一键补货");
        expect(remindersContent).toContain("补货数量");
        expect(remindersContent).toContain("确认补货");
      });

      it("should show success toast with medication names after restock", () => {
        const idx = remindersContent.indexOf("batchRestockMutation = trpc.medReminders.batchRestock.useMutation");
        expect(idx).toBeGreaterThan(-1);
        const block = remindersContent.slice(idx, idx + 500);
        expect(block).toContain("已补货");
        expect(block).toContain("result.names.join");
      });

      it("should invalidate medReminders.list after successful restock", () => {
        const idx = remindersContent.indexOf("batchRestockMutation = trpc.medReminders.batchRestock.useMutation");
        const block = remindersContent.slice(idx, idx + 500);
        expect(block).toContain("medReminders.list.invalidate()");
      });
    });
  });

  describe("Feature 3: Animated stock quantity", () => {
    it("AnimatedNumber component should exist", () => {
      expect(animatedNumberContent).toBeTruthy();
    });

    it("AnimatedNumber should accept value and duration props", () => {
      expect(animatedNumberContent).toContain("value: number");
      expect(animatedNumberContent).toContain("duration");
    });

    it("AnimatedNumber should use requestAnimationFrame for smooth animation", () => {
      expect(animatedNumberContent).toContain("requestAnimationFrame");
      expect(animatedNumberContent).toContain("cancelAnimationFrame");
    });

    it("AnimatedNumber should use easing function for smooth deceleration", () => {
      // Ease out cubic
      expect(animatedNumberContent).toContain("eased");
      expect(animatedNumberContent).toContain("Math.pow");
    });

    it("AnimatedNumber should flash green for increase and red for decrease", () => {
      expect(animatedNumberContent).toContain("text-emerald-600");
      expect(animatedNumberContent).toContain("text-red-600");
    });

    it("AnimatedNumber should track previous value with useRef", () => {
      expect(animatedNumberContent).toContain("prevValueRef");
      expect(animatedNumberContent).toContain("useRef");
    });

    it("AnimatedNumber should have data-testid for testing", () => {
      expect(animatedNumberContent).toContain('data-testid="animated-number"');
    });

    it("MedicationReminders should import AnimatedNumber", () => {
      expect(remindersContent).toContain('import AnimatedNumber from "@/components/AnimatedNumber"');
    });

    it("MedicationReminders should use AnimatedNumber for stock display", () => {
      expect(remindersContent).toContain("<AnimatedNumber value={reminder.stockQuantity}");
    });

    it("AnimatedNumber should be used in both low-stock and normal stock tags", () => {
      // Count occurrences of AnimatedNumber in the stock display area
      const matches = remindersContent.match(/<AnimatedNumber value={reminder\.stockQuantity}/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
  });
});
