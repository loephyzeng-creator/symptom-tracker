/**
 * Tests for painkiller threshold push notification feature:
 * 1. Database schema has painkillerAlertEnabled and painkillerAlertLastDate fields
 * 2. DB helper functions exist for painkiller alert management
 * 3. Router procedures exist for getting/setting painkiller alert enabled
 * 4. ReminderScheduler includes painkiller threshold check
 * 5. Frontend PainkillerLimitSetting includes alert toggle
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { readRoutersContent } from "./test-compat";

describe("Painkiller Threshold Alert Feature", () => {
  describe("Database Schema", () => {
    it("notificationSettings table has painkillerAlertEnabled column", () => {
      const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
      const content = fs.readFileSync(schemaPath, "utf-8");
      expect(content).toContain("painkillerAlertEnabled");
      expect(content).toContain("painkillerAlertLastDate");
    });
  });

  describe("DB Helper Functions", () => {
    it("getPainkillerAlertEnabled function exists", async () => {
      const db = await import("./db");
      expect(typeof db.getPainkillerAlertEnabled).toBe("function");
    });

    it("updatePainkillerAlertEnabled function exists", async () => {
      const db = await import("./db");
      expect(typeof db.updatePainkillerAlertEnabled).toBe("function");
    });

    it("updatePainkillerAlertLastDate function exists", async () => {
      const db = await import("./db");
      expect(typeof db.updatePainkillerAlertLastDate).toBe("function");
    });

    it("getUsersForPainkillerAlert function exists", async () => {
      const db = await import("./db");
      expect(typeof db.getUsersForPainkillerAlert).toBe("function");
    });
  });

  describe("Router Procedures", () => {
    it("notification.getPainkillerAlertEnabled procedure exists", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("notification.getPainkillerAlertEnabled");
    });

    it("notification.updatePainkillerAlertEnabled procedure exists", async () => {
      const { appRouter } = await import("./routers");
      expect(appRouter._def.procedures).toHaveProperty("notification.updatePainkillerAlertEnabled");
    });

    it("getSettings returns painkillerAlertEnabled in default", () => {
      const content = readRoutersContent();
      expect(content).toContain("painkillerAlertEnabled: 1");
    });
  });

  describe("Reminder Scheduler", () => {
    it("checkAndSendPainkillerThresholdAlerts function is exported", async () => {
      const scheduler = await import("./reminderScheduler");
      expect(typeof scheduler.checkAndSendPainkillerThresholdAlerts).toBe("function");
    });

    it("scheduler imports painkiller alert helpers", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("getUsersForPainkillerAlert");
      expect(content).toContain("getPainkillerUsageLast30Days");
      expect(content).toContain("updatePainkillerAlertLastDate");
    });

    it("scheduler checks painkiller threshold at 20:00", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("hour === 20");
      expect(content).toContain("checkAndSendPainkillerThresholdAlerts");
    });

    it("sends exceeded alert when usage >= limit", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("usageDays >= limit");
      expect(content).toContain("\\u6b62\\u75bc\\u836f\\u4f7f\\u7528\\u8d85\\u9650\\u63d0\\u9192"); // 止疼药使用超限提醒
      expect(content).toContain("painkiller-threshold-exceeded");
    });

    it("sends warning alert when usage >= 70% of limit", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("usageDays >= warningThreshold");
      expect(content).toContain("\\u6b62\\u75bc\\u836f\\u4f7f\\u7528\\u63a5\\u8fd1\\u4e0a\\u9650"); // 止疼药使用接近上限
      expect(content).toContain("painkiller-threshold-warning");
    });

    it("calculates warning threshold as 70% of limit", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("Math.ceil(limit * 0.7)");
    });

    it("prevents duplicate daily alerts via updatePainkillerAlertLastDate", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("updatePainkillerAlertLastDate(user.userId, todayStr)");
    });
  });

  describe("Frontend PainkillerLimitSetting", () => {
    it("includes push notification toggle switch", () => {
      const componentPath = path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx");
      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toContain("Switch");
      expect(content).toContain("updatePainkillerAlertEnabled");
      expect(content).toContain("推送通知提醒");
    });

    it("shows different states for enabled/disabled", () => {
      const componentPath = path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx");
      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toContain("Bell");
      expect(content).toContain("BellOff");
      expect(content).toContain("接近阈值70%或超限时推送到手机");
      expect(content).toContain("已关闭推送通知");
    });

    it("shows toast feedback on toggle", () => {
      const componentPath = path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx");
      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toContain("止疼药阈值通知已开启");
      expect(content).toContain("止疼药阈值通知已关闭");
    });
  });
});
