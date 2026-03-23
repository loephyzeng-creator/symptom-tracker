/**
 * 异常预警规则的 localStorage 操作
 */
import { storage, generateId } from "./storage";

export interface AlertRuleLocal {
  id: number;
  userId: number;
  symptomKey: string;
  threshold: number;
  operator: "gt" | "lt" | "gte" | "lte";
  isActive: number;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertHistoryLocal {
  id: number;
  userId: number;
  ruleId: number;
  symptomKey: string;
  value: number;
  date: string;
  isRead: number;
  createdAt: string;
}

export function getAlertRules(): AlertRuleLocal[] {
  return storage.getItem<AlertRuleLocal[]>(storage.KEYS.ALERT_RULES, []);
}

export function saveAlertRules(rules: AlertRuleLocal[]): void {
  storage.setItem(storage.KEYS.ALERT_RULES, rules);
}

export function createAlertRule(
  data: Omit<AlertRuleLocal, "id" | "userId" | "createdAt" | "updatedAt">
): AlertRuleLocal {
  const rules = getAlertRules();
  const now = new Date().toISOString();
  const newRule: AlertRuleLocal = {
    ...data,
    id: generateId(),
    userId: 1,
    createdAt: now,
    updatedAt: now,
  };
  saveAlertRules([...rules, newRule]);
  return newRule;
}

export function updateAlertRule(
  id: number,
  data: Partial<AlertRuleLocal>
): AlertRuleLocal | null {
  const rules = getAlertRules();
  const now = new Date().toISOString();
  let updated: AlertRuleLocal | null = null;
  const newRules = rules.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, ...data, id, updatedAt: now };
    return updated;
  });
  saveAlertRules(newRules);
  return updated;
}

export function deleteAlertRule(id: number): void {
  const rules = getAlertRules();
  saveAlertRules(rules.filter((r) => r.id !== id));
}

export function getAlertHistory(): AlertHistoryLocal[] {
  return storage.getItem<AlertHistoryLocal[]>(storage.KEYS.ALERT_HISTORY, []);
}

export function saveAlertHistory(history: AlertHistoryLocal[]): void {
  storage.setItem(storage.KEYS.ALERT_HISTORY, history);
}

export function getUnreadAlertCount(): number {
  const history = getAlertHistory();
  return history.filter((h) => h.isRead === 0).length;
}

export function markAlertsRead(): void {
  const history = getAlertHistory();
  saveAlertHistory(history.map((h) => ({ ...h, isRead: 1 })));
}
