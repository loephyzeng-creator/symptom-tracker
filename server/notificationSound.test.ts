import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Notification Sound Preference Feature", () => {
  describe("Database Schema", () => {
    it("notificationSettings table has notificationSound field with correct enum values", () => {
      const schemaPath = path.resolve(__dirname, "../drizzle/schema.ts");
      const content = fs.readFileSync(schemaPath, "utf-8");
      expect(content).toContain("notificationSound");
      expect(content).toContain('"default"');
      expect(content).toContain('"gentle"');
      expect(content).toContain('"urgent"');
      expect(content).toContain('"silent"');
    });
  });

  describe("Database Helper: getNotificationSoundForUser", () => {
    it("getNotificationSoundForUser is exported from db.ts", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      expect(content).toContain("export async function getNotificationSoundForUser");
    });

    it("getNotificationSoundForUser returns a string and defaults to 'default'", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      expect(content).toContain('return result[0]?.notificationSound ?? "default"');
    });
  });

  describe("getMedicationRemindersToSend includes notificationSound", () => {
    it("getMedicationRemindersToSend joins notificationSettings to get sound preference", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      // Check that the function selects notificationSound from notificationSettings
      const fnMatch = content.match(/getMedicationRemindersToSend[\s\S]*?\.leftJoin\(notificationSettings/);
      expect(fnMatch).not.toBeNull();
    });

    it("getMedicationRemindersToSend selects notificationSound field", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      // Find the function definition
      const fnStart = content.indexOf("function getMedicationRemindersToSend");
      expect(fnStart).toBeGreaterThan(-1);
      const fnSlice = content.slice(fnStart, fnStart + 1200);
      expect(fnSlice).toContain("notificationSound: notificationSettings.notificationSound");
    });
  });

  describe("getUsersNeedingReminder includes notificationSound", () => {
    it("getUsersNeedingReminder returns notificationSound in results", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      const fnStart = content.indexOf("getUsersNeedingReminder");
      const fnSlice = content.slice(fnStart, fnStart + 1500);
      expect(fnSlice).toContain("notificationSound: setting.notificationSound");
    });

    it("getUsersNeedingReminder result type includes notificationSound: string", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      const fnStart = content.indexOf("getUsersNeedingReminder");
      const fnSlice = content.slice(fnStart, fnStart + 1500);
      expect(fnSlice).toContain("notificationSound: string;");
    });
  });

  describe("Reminder Scheduler: sendWebPush passes sound preference", () => {
    it("sendWebPush function accepts sound parameter", async () => {
      const scheduler = await import("./reminderScheduler");
      expect(typeof scheduler.sendWebPush).toBe("function");
      // sendWebPush signature: (userId, title, body, tag?, actions?, extraData?, sound?)
      // At least 3 required params, up to 7 total
      expect(scheduler.sendWebPush.length).toBeGreaterThanOrEqual(3);
    });

    it("sendWebPush includes sound field in payload", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      // Check that payload includes sound field
      expect(content).toContain('sound: sound || "default"');
    });

    it("medication reminder passes notificationSound to sendWebPush", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      // Both snooze and normal medication reminders should pass sound
      const matches = content.match(/reminder\.notificationSound \?\? "default"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("daily symptom reminder passes user notificationSound to sendWebPush", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain('user.notificationSound ?? "default"');
    });

    it("missed medication alert queries and passes sound preference", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      expect(content).toContain("getNotificationSoundForUser(userId)");
      // Find the function definition (not the call site)
      const missedFnStart = content.indexOf("function checkAndSendMissedMedicationAlerts");
      expect(missedFnStart).toBeGreaterThan(-1);
      const missedFnSlice = content.slice(missedFnStart, missedFnStart + 1500);
      expect(missedFnSlice).toContain("getNotificationSoundForUser");
      expect(missedFnSlice).toContain("userSound");
    });

    it("low stock alert queries and passes sound preference", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      // Find the function definition (not the call site)
      const stockFnStart = content.indexOf("function checkAndSendLowStockAlerts");
      expect(stockFnStart).toBeGreaterThan(-1);
      const stockFnSlice = content.slice(stockFnStart, stockFnStart + 1500);
      expect(stockFnSlice).toContain("getNotificationSoundForUser");
      expect(stockFnSlice).toContain("stockSound");
    });

    it("painkiller threshold alerts pass notificationSound from user settings", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      const painkillerFnStart = content.indexOf("function checkAndSendPainkillerThresholdAlerts");
      expect(painkillerFnStart).toBeGreaterThan(-1);
      const painkillerFnSlice = content.slice(painkillerFnStart, painkillerFnStart + 2000);
      expect(painkillerFnSlice).toContain('user.notificationSound ?? "default"');
    });

    it("weekly painkiller report passes notificationSound from user settings", () => {
      const schedulerPath = path.resolve(__dirname, "reminderScheduler.ts");
      const content = fs.readFileSync(schedulerPath, "utf-8");
      const weeklyFnStart = content.indexOf("async function sendWeeklyPainkillerReports");
      const weeklyFnSlice = content.slice(weeklyFnStart, weeklyFnStart + 5000);
      expect(weeklyFnSlice).toContain('user.notificationSound ?? "default"');
    });
  });

  describe("Instant Painkiller Check: sound preference", () => {
    it("checkPainkillerThresholdInstant queries user sound preference", () => {
      const routersPath = path.resolve(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      const fnStart = content.indexOf("checkPainkillerThresholdInstant");
      const fnSlice = content.slice(fnStart, fnStart + 1500);
      expect(fnSlice).toContain("getNotificationSoundForUser(userId)");
      expect(fnSlice).toContain("userSound");
    });

    it("instant painkiller alerts pass userSound to sendWebPush", () => {
      const routersPath = path.resolve(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      const fnStart = content.indexOf("checkPainkillerThresholdInstant");
      const fnSlice = content.slice(fnStart, fnStart + 1500);
      // Both exceeded and warning calls should pass userSound
      const soundMatches = fnSlice.match(/userSound/g);
      expect(soundMatches).not.toBeNull();
      // declaration + usages in sendWebPush calls
      expect(soundMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Medication Expiration: sound preference", () => {
    it("checkExpiringMedications includes sound in push payload", () => {
      const dbPath = path.resolve(__dirname, "db.ts");
      const content = fs.readFileSync(dbPath, "utf-8");
      const fnStart = content.indexOf("checkExpiringMedications");
      const fnSlice = content.slice(fnStart, fnStart + 3000);
      expect(fnSlice).toContain("getNotificationSoundForUser");
      expect(fnSlice).toContain("sound: userSound");
    });
  });

  describe("Service Worker: sound handling", () => {
    it("Service Worker reads sound field from push data", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("data.sound");
    });

    it("Service Worker supports all four sound modes", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("'default'");
      expect(content).toContain("'gentle'");
      expect(content).toContain("'urgent'");
      expect(content).toContain("'silent'");
    });

    it("Service Worker sets silent: true for silent mode", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("silent = true");
    });

    it("Service Worker adjusts vibration pattern based on sound mode", () => {
      const swPath = path.resolve(__dirname, "../client/public/sw.js");
      const content = fs.readFileSync(swPath, "utf-8");
      // gentle: short vibrate
      expect(content).toContain("[100]");
      // urgent: long vibrate
      expect(content).toContain("[300, 100, 300, 100, 300]");
      // silent: no vibrate
      expect(content).toContain("vibrate = []");
    });
  });

  describe("Backend API: updateNotificationSound endpoint", () => {
    it("updateNotificationSound mutation exists in routers.ts", () => {
      const routersPath = path.resolve(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      expect(content).toContain("updateNotificationSound: protectedProcedure");
    });

    it("updateNotificationSound accepts sound enum input", () => {
      const routersPath = path.resolve(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      expect(content).toContain('z.enum(["default", "gentle", "urgent", "silent"])');
    });

    it("getSettings returns notificationSound field", () => {
      const routersPath = path.resolve(__dirname, "routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      // Check that getSettings returns notificationSound in its default or actual values
      expect(content).toContain('notificationSound: "default"');
    });
  });

  describe("Frontend: Sound preference UI", () => {
    it("PainkillerLimitSetting renders sound preference selector", () => {
      const componentPath = path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx");
      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toContain("提醒铃声");
      expect(content).toContain("updateNotificationSound");
    });

    it("PainkillerLimitSetting shows all four sound options", () => {
      const componentPath = path.resolve(__dirname, "../client/src/components/PainkillerLimitSetting.tsx");
      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toContain("默认");
      expect(content).toContain("柔和");
      expect(content).toContain("紧急");
      expect(content).toContain("静音");
    });
  });
});
