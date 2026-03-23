/**
 * 自定义指标的 localStorage 操作
 */
import { storage, generateId } from "./storage";

export interface CustomMetricLocal {
  id: number;
  userId: number;
  name: string;
  description?: string | null;
  isHighGood: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomMetricValueLocal {
  id: number;
  userId: number;
  metricId: number;
  date: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export function getCustomMetrics(): CustomMetricLocal[] {
  return storage.getItem<CustomMetricLocal[]>(storage.KEYS.CUSTOM_METRICS, []);
}

export function saveCustomMetrics(metrics: CustomMetricLocal[]): void {
  storage.setItem(storage.KEYS.CUSTOM_METRICS, metrics);
}

export function addCustomMetric(
  name: string,
  description?: string | null,
  isHighGood?: number
): CustomMetricLocal {
  const metrics = getCustomMetrics();
  const now = new Date().toISOString();
  const newMetric: CustomMetricLocal = {
    id: generateId(),
    userId: 1,
    name,
    description: description ?? null,
    isHighGood: isHighGood ?? 0,
    sortOrder: metrics.length,
    createdAt: now,
    updatedAt: now,
  };
  saveCustomMetrics([...metrics, newMetric]);
  return newMetric;
}

export function updateCustomMetric(
  id: number,
  data: Partial<CustomMetricLocal>
): CustomMetricLocal | null {
  const metrics = getCustomMetrics();
  const now = new Date().toISOString();
  let updated: CustomMetricLocal | null = null;
  const newMetrics = metrics.map((m) => {
    if (m.id !== id) return m;
    updated = { ...m, ...data, id, updatedAt: now };
    return updated;
  });
  saveCustomMetrics(newMetrics);
  return updated;
}

export function deleteCustomMetric(id: number): void {
  const metrics = getCustomMetrics();
  saveCustomMetrics(metrics.filter((m) => m.id !== id));
  // Also delete values
  const values = getCustomMetricValues();
  saveCustomMetricValues(values.filter((v) => v.metricId !== id));
}

export function getCustomMetricValues(): CustomMetricValueLocal[] {
  return storage.getItem<CustomMetricValueLocal[]>(storage.KEYS.CUSTOM_METRIC_VALUES, []);
}

export function saveCustomMetricValues(values: CustomMetricValueLocal[]): void {
  storage.setItem(storage.KEYS.CUSTOM_METRIC_VALUES, values);
}

export function getCustomMetricValuesForDate(date: string): Record<number, number> {
  const values = getCustomMetricValues();
  const result: Record<number, number> = {};
  values
    .filter((v) => v.date === date)
    .forEach((v) => {
      result[v.metricId] = v.value;
    });
  return result;
}

export function saveCustomMetricValuesForDate(
  date: string,
  values: Record<number, number>
): void {
  const allValues = getCustomMetricValues();
  const now = new Date().toISOString();
  const filtered = allValues.filter((v) => v.date !== date);
  const newValues = Object.entries(values).map(([metricId, value]) => ({
    id: generateId(),
    userId: 1,
    metricId: Number(metricId),
    date,
    value,
    createdAt: now,
    updatedAt: now,
  }));
  saveCustomMetricValues([...filtered, ...newValues]);
}
