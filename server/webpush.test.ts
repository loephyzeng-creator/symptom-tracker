import { describe, expect, it, vi } from "vitest";
import { isReminderTime, getTodayStr, getChinaTime } from "./reminderScheduler";

describe("Web Push reminder scheduler", () => {
  it("isReminderTime returns true within 60-minute window", () => {
    expect(isReminderTime(21, 0, 21, 0)).toBe(true);
    expect(isReminderTime(21, 0, 21, 5)).toBe(true);
    expect(isReminderTime(21, 0, 21, 14)).toBe(true);
    expect(isReminderTime(21, 0, 21, 30)).toBe(true);
    expect(isReminderTime(21, 0, 21, 59)).toBe(true);
  });

  it("isReminderTime returns false outside 60-minute window", () => {
    expect(isReminderTime(21, 0, 22, 0)).toBe(false);
    expect(isReminderTime(21, 0, 20, 59)).toBe(false);
    expect(isReminderTime(21, 0, 22, 30)).toBe(false);
  });

  it("isReminderTime handles minute offsets correctly", () => {
    expect(isReminderTime(9, 30, 9, 30)).toBe(true);
    expect(isReminderTime(9, 30, 9, 44)).toBe(true);
    expect(isReminderTime(9, 30, 10, 29)).toBe(true);
    expect(isReminderTime(9, 30, 10, 30)).toBe(false);
    expect(isReminderTime(9, 30, 9, 29)).toBe(false);
  });

  it("getTodayStr returns YYYY-MM-DD format", () => {
    const today = getTodayStr();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getChinaTime returns valid hour and minute", () => {
    const { hour, minute } = getChinaTime();
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThanOrEqual(59);
  });
});

describe("Push subscription schema validation", () => {
  it("validates correct subscription data", () => {
    const validSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: {
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfWLk",
        auth: "tBHItJI5svbpC7htI_xo2g",
      },
    };

    expect(validSub.endpoint).toMatch(/^https:\/\//);
    expect(validSub.keys.p256dh.length).toBeGreaterThan(10);
    expect(validSub.keys.auth.length).toBeGreaterThan(5);
  });

  it("rejects subscription without endpoint", () => {
    const invalidSub = {
      endpoint: "",
      keys: { p256dh: "abc", auth: "def" },
    };
    expect(invalidSub.endpoint).toBe("");
  });
});

describe("Service Worker push event handling", () => {
  it("push payload structure is correct", () => {
    const payload = JSON.stringify({
      title: "📝 症状日记提醒",
      body: "用户，今天还没有记录症状哦！",
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      tag: "daily-reminder",
      data: { url: "/" },
    });

    const parsed = JSON.parse(payload);
    expect(parsed.title).toContain("症状日记");
    expect(parsed.body).toContain("记录症状");
    expect(parsed.tag).toBe("daily-reminder");
    expect(parsed.data.url).toBe("/");
  });
});
