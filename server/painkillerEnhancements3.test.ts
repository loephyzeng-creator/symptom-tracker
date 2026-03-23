/**
 * Tests for three painkiller notification enhancements:
 * 1. Instant threshold check when recording painkiller
 * 2. Weekly painkiller usage report push
 * 3. Notification click-to-detail navigation (view-trend action)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { readDbContent, readRoutersContent } from "./test-compat";

describe("Feature 1: Instant Painkiller Threshold Check", () => {
  describe("Router integration", () => {
    it("upsert mutation calls checkPainkillerThresholdInstant when painkillerTaken is 1", () => {
      const content = readRoutersContent();
      expect(content).toContain("checkPainkillerThresholdInstant");
      expect(content).toContain("input.painkillerTaken === 1");
    });

    it("togglePainkiller mutation calls checkPainkillerThresholdInstant when toggled ON", () => {
      const content = readRoutersContent();
      // Should check newState before calling
      expect(content).toContain("if (newState)");
      expect(content).toContain("checkPainkillerThresholdInstant(ctx.user.id, input.date)");
    });

    it("checkPainkillerThresholdInstant function is defined in routers.ts", () => {
      const content = readRoutersContent();
      expect(content).toContain("async function checkPainkillerThresholdInstant(userId: number, dateStr: string)");
    });

    it("instant check respects user's alert enabled setting", () => {
      const content = readRoutersContent();
      expect(content).toContain("getPainkillerAlertEnabled");
      expect(content).toContain("if (!alertEnabled) return");
    });

    it("instant check sends exceeded alert with correct tag", () => {
      const content = readRoutersContent();
      expect(content).toContain("painkiller-instant-exceeded");
    });

    it("instant check sends warning alert with correct tag", () => {
      const content = readRoutersContent();
      expect(content).toContain("painkiller-instant-warning");
    });

    it("instant check calls are non-blocking (uses .catch)", () => {
      const content = readRoutersContent();
      expect(content).toContain("checkPainkillerThresholdInstant(ctx.user.id, input.date).catch");
    });

    it("imports sendWebPush from reminderScheduler", () => {
      const content = readRoutersContent();
      expect(content).toContain('import { sendWebPush } from "./reminderScheduler"');
    });
  });
});

describe("Feature 2: Weekly Painkiller Usage Report Push", () => {
  describe("Database helper", () => {
    it("getWeeklyPainkillerReport function exists in db.ts", async () => {
      const db = await import("./db");
      expect(typeof db.getWeeklyPainkillerReport).toBe("function");
    });

    it("getWeeklyPainkillerReport returns correct structure", () => {
      const content = readDbContent();
      expect(content).toContain("thisWeekPainkiller");
      expect(content).toContain("prevWeekPainkiller");
      expect(content).toContain("last30Painkiller");
      expect(content).toContain("trend");
      expect(content).toContain("painkillerWithHeadache");
      expect(content).toContain("painkillerWithoutHeadache");
      expect(content).toContain("avgHeadachePainkiller");
      expect(content).toContain("avgHeadacheNoPainkiller");
    });

    it("calculates trend by comparing this week vs previous week", () => {
      const content = readDbContent();
      expect(content).toContain("thisWeekPainkiller > prevWeekPainkiller");
      expect(content).toContain("thisWeekPainkiller < prevWeekPainkiller");
      expect(content).toContain('"up" | "down" | "stable"');
    });

    it("calculates headache correlation correctly", () => {
      const content = readDbContent();
      expect(content).toContain("painkillerTaken === 1 && (e.headache >= 5");
      expect(content).toContain("avgHeadachePainkiller");
      expect(content).toContain("avgHeadacheNoPainkiller");
    });
  });

  describe("Scheduler integration", () => {
    it("sendWeeklyPainkillerReports function is exported", async () => {
      const scheduler = await import("./reminderScheduler");
      expect(typeof scheduler.sendWeeklyPainkillerReports).toBe("function");
    });

    it("weekly report runs based on user frequency preference", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      // Weekly report now supports per-user frequency (weekly/biweekly/monthly)
      expect(content).toContain("dayOfWeek === 0"); // Sunday check for weekly
      expect(content).toContain("sendWeeklyPainkillerReports");
    });

    it("weekly report includes trend emoji and text", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      // Content uses unicode escapes, check for the escape sequences
      expect(content).toContain("\\u589e\\u52a0"); // 增加
      expect(content).toContain("\\u51cf\\u5c11"); // 减少
      expect(content).toContain("\\u6301\\u5e73"); // 持平
    });

    it("weekly report includes headache correlation info", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("\\u5934\\u75db\\u5173\\u8054"); // 头痛关联
      expect(content).toContain("\\u4f34\\u5934\\u75db"); // 伴头痛
      expect(content).toContain("\\u65e0\\u5934\\u75db"); // 无头痛
    });

    it("weekly report includes average headache comparison", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("\\u5e73\\u5747\\u5934\\u75db"); // 平均头痛
      expect(content).toContain("\\u7528\\u836f\\u65e5"); // 用药日
      expect(content).toContain("\\u672a\\u7528\\u836f\\u65e5"); // 未用药日
    });

    it("weekly report uses correct notification tag", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("painkiller-weekly-report");
      expect(content).toContain("\\u6b62\\u75bc\\u836f\\u5468\\u62a5"); // 止疼药周报
    });

    it("weekly report includes 30-day cumulative count and limit", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("\\u8fd130\\u5929\\u7d2f\\u8ba1"); // 近30天累计
    });
  });
});

describe("Feature 3: Notification Click-to-Detail Navigation", () => {
  describe("Service Worker", () => {
    it("sw.js handles view-trend action", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("action === 'view-trend'");
    });

    it("view-trend action navigates to medication tab", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("/?tab=medication");
    });

    it("default notification click navigates to data.url", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("notificationData.url || '/'");
      expect(content).toContain("client.navigate(urlToOpen)");
    });
  });

  describe("Frontend deep linking", () => {
    it("Home.tsx reads tab from URL query params on init", () => {
      const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      expect(content).toContain("URLSearchParams(window.location.search)");
      expect(content).toContain('params.get("tab")');
    });

    it("Home.tsx listens for popstate events for tab switching", () => {
      const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      expect(content).toContain("popstate");
      expect(content).toContain("handlePopState");
    });

    it("supports all valid tab keys in URL params", () => {
      const homePath = path.resolve(__dirname, "../client/src/pages/Home.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      expect(content).toContain('"record"');
      expect(content).toContain('"medication"');
      expect(content).toContain('"stats"');
      expect(content).toContain('"history"');
      expect(content).toContain('"settings"');
    });
  });

  describe("Notification payloads include URL and actions", () => {
    it("instant alerts include view-trend action button", () => {
      const content = readRoutersContent();
      expect(content).toContain('"view-trend"');
      expect(content).toContain("\\u67e5\\u770b\\u8be6\\u60c5"); // 查看详情
    });

    it("instant alerts include medication tab URL", () => {
      const content = readRoutersContent();
      expect(content).toContain('url: "/?tab=medication"');
    });

    it("daily scheduled alerts include view-trend action button", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      // Both exceeded and warning alerts + weekly report should have action buttons
      const viewTrendMatches = content.match(/action: "view-trend"/g);
      expect(viewTrendMatches).not.toBeNull();
      expect(viewTrendMatches!.length).toBeGreaterThanOrEqual(3); // daily exceeded + daily warning + weekly
    });

    it("weekly report includes view-trend action button", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("painkiller-weekly-report");
      expect(content).toContain('url: "/?tab=medication"');
    });
  });
});
