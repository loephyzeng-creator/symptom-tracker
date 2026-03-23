/**
 * 通知设置的 localStorage 操作
 */
import { storage } from "./storage";

export interface NotificationSettingsLocal {
  enabled: number;
  reminderHour: number;
  reminderMinute: number;
  painkillerDayLimit: number;
  painkillerAlertEnabled: number;
  weeklyReportFrequency: "daily" | "weekly" | "biweekly" | "monthly";
  weeklyReportHour: number;
  notificationSound: "default" | "gentle" | "silent";
  timezone: string;
}

const DEFAULT_SETTINGS: NotificationSettingsLocal = {
  enabled: 1,
  reminderHour: 21,
  reminderMinute: 0,
  painkillerDayLimit: 10,
  painkillerAlertEnabled: 1,
  weeklyReportFrequency: "weekly",
  weeklyReportHour: 19,
  notificationSound: "default",
  timezone: "Asia/Shanghai",
};

export function getNotificationSettings(): NotificationSettingsLocal {
  return storage.getItem<NotificationSettingsLocal>(
    storage.KEYS.NOTIFICATION_SETTINGS,
    DEFAULT_SETTINGS
  );
}

export function saveNotificationSettings(
  settings: Partial<NotificationSettingsLocal>
): NotificationSettingsLocal {
  const current = getNotificationSettings();
  const updated = { ...current, ...settings };
  storage.setItem(storage.KEYS.NOTIFICATION_SETTINGS, updated);
  return updated;
}

export function getPainkillerDayLimit(): number {
  return getNotificationSettings().painkillerDayLimit;
}

export function getPainkillerAlertEnabled(): boolean {
  return getNotificationSettings().painkillerAlertEnabled === 1;
}
