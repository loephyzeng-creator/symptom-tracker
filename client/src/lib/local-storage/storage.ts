/**
 * localStorage 核心存储工具
 * 替代后端数据库，所有数据存储在浏览器本地
 */

const KEYS = {
  ENTRIES: "symptom_entries",
  TRIGGERS: "symptom_triggers",
  MED_REMINDERS: "med_reminders",
  MED_GROUPS: "med_groups",
  MED_RESTOCKS: "med_restocks",
  MED_CHECKINS: "med_checkins",
  DRUG_INTERACTIONS: "drug_interactions",
  CUSTOM_METRICS: "custom_metrics",
  CUSTOM_METRIC_VALUES: "custom_metric_values",
  ALERT_RULES: "alert_rules",
  ALERT_HISTORY: "alert_history",
  NOTIFICATION_SETTINGS: "notification_settings",
  PAINKILLER_SETTINGS: "painkiller_settings",
  SYNC_STATUS: "sync_status",
};

export { KEYS };

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

let nextId = Date.now();
export function generateId(): number {
  return ++nextId;
}

export const storage = { getItem, setItem, KEYS };
