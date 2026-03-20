import { useState, useCallback, useEffect } from "react";

export interface MedicationItem {
  name: string;
  dosage: string;
}

export interface SymptomEntry {
  id: string;
  date: string; // YYYY-MM-DD
  dizziness: number; // 0-10
  headache: number; // 0-10
  sleepQuality: number; // 0-10 (10=best)
  anxiety: number; // 0-10
  fatigue: number; // 0-10
  photosensitivity: number; // 0-10
  motionSickness: number; // 0-10
  palpitations: number; // 0-10
  mood: number; // 0-10 (10=best)
  notes: string;
  medications: string | MedicationItem[]; // backward compatible: old=string, new=array
  triggers: string[];
  createdAt: string;
}

/** Normalize medications to always return MedicationItem[] */
export function normalizeMedications(meds: string | MedicationItem[]): MedicationItem[] {
  if (Array.isArray(meds)) return meds;
  if (!meds || !meds.trim()) return [];
  // Legacy string: try to parse each line as "name dosage"
  return meds.split(/[,，\n]/).filter(Boolean).map((s) => {
    const trimmed = s.trim();
    return { name: trimmed, dosage: "" };
  });
}

/** Format medications for display */
export function formatMedications(meds: string | MedicationItem[]): string {
  const items = normalizeMedications(meds);
  if (items.length === 0) return "";
  return items
    .map((m) => (m.dosage ? `${m.name} ${m.dosage}` : m.name))
    .join("、");
}

const STORAGE_KEY = "symptom-tracker-data";

function loadEntries(): SymptomEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveEntries(entries: SymptomEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useSymptomData() {
  const [entries, setEntries] = useState<SymptomEntry[]>(() => loadEntries());

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  const addEntry = useCallback((entry: Omit<SymptomEntry, "id" | "createdAt">) => {
    const newEntry: SymptomEntry = {
      ...entry,
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => {
      // Replace if same date exists
      const filtered = prev.filter((e) => e.date !== entry.date);
      return [...filtered, newEntry].sort((a, b) => a.date.localeCompare(b.date));
    });
    return newEntry;
  }, []);

  const updateEntry = useCallback((id: string, updates: Partial<SymptomEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const getEntryByDate = useCallback(
    (date: string) => entries.find((e) => e.date === date),
    [entries]
  );

  const getEntriesInRange = useCallback(
    (startDate: string, endDate: string) =>
      entries.filter((e) => e.date >= startDate && e.date <= endDate),
    [entries]
  );

  const exportData = useCallback(() => {
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `症状日记_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const importData = useCallback((jsonStr: string) => {
    try {
      const imported = JSON.parse(jsonStr) as SymptomEntry[];
      if (Array.isArray(imported)) {
        setEntries(imported.sort((a, b) => a.date.localeCompare(b.date)));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return {
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntryByDate,
    getEntriesInRange,
    exportData,
    importData,
  };
}
