import { useCallback, useMemo, useState } from "react";
import { getLocalDateStr } from "@shared/timezone";
import {
  getEntries,
  upsertEntry,
  deleteEntry as deleteEntryFromStorage,
  getPainkillerUsageLast30Days,
  updatePainkillerDetail,
  togglePainkillerForDate,
} from "@/lib/local-storage";

export interface MedicationItem {
  name: string;
  dosage: string;
  reminderId?: number;
  timeIndex?: number;
}

export interface SymptomEntry {
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
  medications: MedicationItem[];
  triggers: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeMedications(
  meds: string | MedicationItem[] | null | undefined
): MedicationItem[] {
  if (!meds) return [];
  if (Array.isArray(meds)) return meds;
  if (typeof meds === "string") {
    if (!meds.trim()) return [];
    return meds.split(/[,，\n]/).filter(Boolean).map((s) => ({ name: s.trim(), dosage: "" }));
  }
  return [];
}

export function formatMedications(
  meds: string | MedicationItem[] | null | undefined
): string {
  const items = normalizeMedications(meds);
  if (items.length === 0) return "";
  return items.map((m) => (m.dosage ? `${m.name} ${m.dosage}` : m.name)).join("、");
}

function toSymptomEntry(raw: ReturnType<typeof getEntries>[0]): SymptomEntry {
  return { ...raw, createdAt: new Date(raw.createdAt), updatedAt: new Date(raw.updatedAt) };
}

export function useSymptomData() {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const entries: SymptomEntry[] = useMemo(() => {
    const raw = getEntries();
    return [...raw].sort((a, b) => a.date.localeCompare(b.date)).map(toSymptomEntry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const addEntry = useCallback(
    async (entry: Omit<SymptomEntry, "id" | "userId" | "createdAt" | "updatedAt">) => {
      const result = upsertEntry({
        date: entry.date,
        dizziness: entry.dizziness,
        headache: entry.headache,
        sleepQuality: entry.sleepQuality,
        anxiety: entry.anxiety,
        fatigue: entry.fatigue,
        photosensitivity: entry.photosensitivity,
        motionSickness: entry.motionSickness,
        palpitations: entry.palpitations,
        mood: entry.mood,
        medications: normalizeMedications(entry.medications),
        triggers: entry.triggers,
        severeHeadache: entry.severeHeadache ?? 0,
        painkillerTaken: entry.painkillerTaken ?? 0,
        painkillerBrand: entry.painkillerBrand ?? null,
        painkillerDosage: entry.painkillerDosage ?? null,
        notes: entry.notes ?? null,
      });
      refresh();
      return result;
    },
    [refresh]
  );

  const deleteEntry = useCallback(
    async (id: number) => { deleteEntryFromStorage(id); refresh(); },
    [refresh]
  );

  const getEntryByDate = useCallback(
    (date: string) => entries.find((e) => e.date === date),
    [entries]
  );

  const exportData = useCallback(() => {
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `症状日记_${getLocalDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const exportCSV = useCallback(() => {
    if (entries.length === 0) return;
    const headers = ["日期","头晕","头痛","睡眠质量","焦虑","疲劳","畏光","运动敏感","心慌","心情","头痛发作","止疼药","用药","诱因","备注"];
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`;
      return val;
    };
    const rows = entries.map((e) => [
      e.date, String(e.dizziness), String(e.headache), String(e.sleepQuality),
      String(e.anxiety), String(e.fatigue), String(e.photosensitivity),
      String(e.motionSickness), String(e.palpitations), String(e.mood),
      e.severeHeadache === 0 ? "无" : e.severeHeadache === 1 ? "轻微" : e.severeHeadache === 2 ? "明显" : "严重",
      e.painkillerTaken === 1 ? "是" : "否",
      escapeCSV(formatMedications(e.medications)),
      escapeCSV(Array.isArray(e.triggers) ? e.triggers.join("、") : ""),
      escapeCSV(e.notes ?? ""),
    ]);
    const bom = "\uFEFF";
    const csvContent = bom + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `症状日记_${getLocalDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const importData = useCallback(async (jsonStr: string) => {
    try {
      const imported = JSON.parse(jsonStr);
      if (!Array.isArray(imported)) return false;
      for (const entry of imported) {
        upsertEntry({
          date: entry.date,
          dizziness: entry.dizziness ?? 0,
          headache: entry.headache ?? 0,
          sleepQuality: entry.sleepQuality ?? 5,
          anxiety: entry.anxiety ?? 0,
          fatigue: entry.fatigue ?? 0,
          photosensitivity: entry.photosensitivity ?? 0,
          motionSickness: entry.motionSickness ?? 0,
          palpitations: entry.palpitations ?? 0,
          mood: entry.mood ?? 5,
          medications: normalizeMedications(entry.medications),
          triggers: entry.triggers ?? [],
          severeHeadache: entry.severeHeadache ?? 0,
          painkillerTaken: entry.painkillerTaken ?? 0,
          painkillerBrand: entry.painkillerBrand ?? null,
          painkillerDosage: entry.painkillerDosage ?? null,
          notes: entry.notes ?? null,
        });
      }
      refresh();
      return true;
    } catch { return false; }
  }, [refresh]);

  const getPainkillerUsage = useCallback((fromDate: string) => {
    return getPainkillerUsageLast30Days(fromDate);
  }, []);

  const updatePainkillerDetailFn = useCallback((id: number, brand?: string | null, dosage?: string | null) => {
    updatePainkillerDetail(id, brand, dosage);
    refresh();
  }, [refresh]);

  const togglePainkillerFn = useCallback((date: string) => {
    togglePainkillerForDate(date);
    refresh();
  }, [refresh]);

  return {
    entries,
    addEntry,
    deleteEntry,
    getEntryByDate,
    exportData,
    exportCSV,
    importData,
    getPainkillerUsage,
    updatePainkillerDetail: updatePainkillerDetailFn,
    togglePainkiller: togglePainkillerFn,
    isLoading: false,
    isSaving: false,
    refresh,
  };
}
