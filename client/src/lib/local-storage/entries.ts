/**
 * 症状记录的 localStorage 操作
 */
import { storage, generateId } from "./storage";

export interface SymptomEntryLocal {
  id: number;
  userId: number;
  date: string;
  dizziness: number;
  headache: number;
  sleepQuality: number;
  anxiety: number;
  fatigue: number;
  photosensitivity: number;
  motionSickness: number;
  palpitations: number;
  mood: number;
  severeHeadache: number;
  painkillerTaken: number;
  painkillerBrand?: string | null;
  painkillerDosage?: string | null;
  notes: string | null;
  medications: Array<{ name: string; dosage: string; reminderId?: number; timeIndex?: number }>;
  triggers: string[];
  createdAt: string;
  updatedAt: string;
}

export function getEntries(): SymptomEntryLocal[] {
  return storage.getItem<SymptomEntryLocal[]>(storage.KEYS.ENTRIES, []);
}

export function saveEntries(entries: SymptomEntryLocal[]): void {
  storage.setItem(storage.KEYS.ENTRIES, entries);
}

export function upsertEntry(
  data: Omit<SymptomEntryLocal, "id" | "userId" | "createdAt" | "updatedAt">
): SymptomEntryLocal {
  const entries = getEntries();
  const now = new Date().toISOString();
  const existing = entries.find((e) => e.date === data.date);
  if (existing) {
    const updated = { ...existing, ...data, updatedAt: now };
    const newEntries = entries.map((e) => (e.date === data.date ? updated : e));
    saveEntries(newEntries);
    return updated;
  } else {
    const newEntry: SymptomEntryLocal = {
      ...data,
      id: generateId(),
      userId: 1,
      createdAt: now,
      updatedAt: now,
    };
    saveEntries([...entries, newEntry]);
    return newEntry;
  }
}

export function deleteEntry(id: number): void {
  const entries = getEntries();
  saveEntries(entries.filter((e) => e.id !== id));
}

export function getPainkillerUsageLast30Days(fromDate: string): number {
  const entries = getEntries();
  const d = new Date(fromDate + "T00:00:00");
  d.setDate(d.getDate() - 29);
  const startDate = d.toISOString().slice(0, 10);
  return entries.filter(
    (e) => e.date >= startDate && e.date <= fromDate && e.painkillerTaken === 1
  ).length;
}

export function updatePainkillerDetail(
  id: number,
  brand?: string | null,
  dosage?: string | null
): void {
  const entries = getEntries();
  const newEntries = entries.map((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      painkillerBrand: brand ?? e.painkillerBrand,
      painkillerDosage: dosage ?? e.painkillerDosage,
      updatedAt: new Date().toISOString(),
    };
  });
  saveEntries(newEntries);
}

export function togglePainkillerForDate(date: string): void {
  const entries = getEntries();
  const existing = entries.find((e) => e.date === date);
  if (existing) {
    const newEntries = entries.map((e) => {
      if (e.date !== date) return e;
      return {
        ...e,
        painkillerTaken: e.painkillerTaken === 1 ? 0 : 1,
        updatedAt: new Date().toISOString(),
      };
    });
    saveEntries(newEntries);
  }
}
