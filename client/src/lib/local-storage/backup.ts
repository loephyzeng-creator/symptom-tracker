/**
 * 备份与恢复的 localStorage 操作
 */
import { getEntries, saveEntries } from "./entries";
import { getTriggers, saveTriggers } from "./triggers";
import { getMedReminders, saveMedReminders, getMedCheckIns, saveMedCheckIns, getMedRestocks, saveMedRestocks, getMedGroups, saveMedGroups } from "./medications";
import { getNotificationSettings, saveNotificationSettings } from "./notifications";
import { getCustomMetrics, saveCustomMetrics, getCustomMetricValues, saveCustomMetricValues } from "./customMetrics";
import { getAlertRules, saveAlertRules } from "./alerts";

export interface BackupData {
  version: string;
  exportedAt: string;
  entries: ReturnType<typeof getEntries>;
  customTriggers: ReturnType<typeof getTriggers>;
  medReminders: ReturnType<typeof getMedReminders>;
  medCheckIns: ReturnType<typeof getMedCheckIns>;
  medRestocks: ReturnType<typeof getMedRestocks>;
  medGroups: ReturnType<typeof getMedGroups>;
  notificationSettings: ReturnType<typeof getNotificationSettings>;
  customMetrics: ReturnType<typeof getCustomMetrics>;
  customMetricValues: ReturnType<typeof getCustomMetricValues>;
  alertRules: ReturnType<typeof getAlertRules>;
}

export function exportAllData(): BackupData {
  return {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    entries: getEntries(),
    customTriggers: getTriggers(),
    medReminders: getMedReminders(),
    medCheckIns: getMedCheckIns(),
    medRestocks: getMedRestocks(),
    medGroups: getMedGroups(),
    notificationSettings: getNotificationSettings(),
    customMetrics: getCustomMetrics(),
    customMetricValues: getCustomMetricValues(),
    alertRules: getAlertRules(),
  };
}

export function restoreAllData(data: Partial<BackupData>): {
  entriesRestored: number;
  triggersRestored: number;
} {
  if (data.entries) saveEntries(data.entries);
  if (data.customTriggers) saveTriggers(data.customTriggers);
  if (data.medReminders) saveMedReminders(data.medReminders);
  if (data.medCheckIns) saveMedCheckIns(data.medCheckIns);
  if (data.medRestocks) saveMedRestocks(data.medRestocks);
  if (data.medGroups) saveMedGroups(data.medGroups);
  if (data.notificationSettings) saveNotificationSettings(data.notificationSettings);
  if (data.customMetrics) saveCustomMetrics(data.customMetrics);
  if (data.customMetricValues) saveCustomMetricValues(data.customMetricValues);
  if (data.alertRules) saveAlertRules(data.alertRules);

  return {
    entriesRestored: data.entries?.length ?? 0,
    triggersRestored: data.customTriggers?.length ?? 0,
  };
}

export function getSyncStatus() {
  const entries = getEntries();
  const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const lastUpdated = sorted[0]?.updatedAt ?? null;
  const firstDate = entries.length > 0
    ? entries.sort((a, b) => a.date.localeCompare(b.date))[0].date
    : null;
  const lastDate = entries.length > 0
    ? entries.sort((a, b) => b.date.localeCompare(a.date))[0].date
    : null;

  return {
    totalEntries: entries.length,
    lastUpdated,
    firstDate,
    lastDate,
    isLocalStorage: true,
  };
}
