import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";
import { getLocalDateStr } from "@shared/timezone";

export interface MedicationItem {
  name: string;
  dosage: string;
  reminderId?: number; // Links to medication_reminders.id for data sync
  timeIndex?: number; // Which time slot for multi-dose reminders
}

export interface SymptomEntry {
  id: number;
  userId: number;
  date: string; // YYYY-MM-DD
  dizziness: number;
  headache: number;
  sleepQuality: number;
  anxiety: number;
  fatigue: number;
  photosensitivity: number;
  motionSickness: number;
  palpitations: number;
  mood: number;
  severeHeadache: number; // 0=无, 1=轻微, 2=明显, 3=严重
  painkillerTaken: number; // 0=否, 1=是
  painkillerBrand?: string | null;
  painkillerDosage?: string | null;
  notes: string | null;
  medications: MedicationItem[];
  triggers: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Normalize medications to always return MedicationItem[] */
export function normalizeMedications(
  meds: string | MedicationItem[] | null | undefined
): MedicationItem[] {
  if (!meds) return [];
  if (Array.isArray(meds)) return meds;
  if (typeof meds === "string") {
    if (!meds.trim()) return [];
    return meds
      .split(/[,，\n]/)
      .filter(Boolean)
      .map((s) => ({ name: s.trim(), dosage: "" }));
  }
  return [];
}

/** Format medications for display */
export function formatMedications(
  meds: string | MedicationItem[] | null | undefined
): string {
  const items = normalizeMedications(meds);
  if (items.length === 0) return "";
  return items
    .map((m) => (m.dosage ? `${m.name} ${m.dosage}` : m.name))
    .join("、");
}

export function useSymptomData() {
  const utils = trpc.useUtils();

  const entriesQuery = trpc.entries.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const upsertMutation = trpc.entries.upsert.useMutation({
    onSuccess: () => {
      utils.entries.list.invalidate();
      utils.entries.painkillerUsage.invalidate();
    },
  });

  const deleteMutation = trpc.entries.delete.useMutation({
    onSuccess: () => {
      utils.entries.list.invalidate();
      utils.entries.painkillerUsage.invalidate();
    },
  });

  const entries: SymptomEntry[] = useMemo(() => {
    if (!entriesQuery.data) return [];
    return [...entriesQuery.data].sort((a, b) =>
      a.date.localeCompare(b.date)
    ) as SymptomEntry[];
  }, [entriesQuery.data]);

  const addEntry = useCallback(
    async (
      entry: Omit<SymptomEntry, "id" | "userId" | "createdAt" | "updatedAt">
    ) => {
      const result = await upsertMutation.mutateAsync({
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
        painkillerBrand: entry.painkillerBrand ?? undefined,
        painkillerDosage: entry.painkillerDosage ?? undefined,
        notes: entry.notes ?? undefined,
      });
      return result;
    },
    [upsertMutation]
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      await deleteMutation.mutateAsync({ id });
    },
    [deleteMutation]
  );

  const getEntryByDate = useCallback(
    (date: string) => entries.find((e) => e.date === date),
    [entries]
  );

  const exportData = useCallback(async () => {
    try {
      const data = await utils.backup.export.fetch();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `症状日记_完整备份_${getLocalDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Export failed:", error);
      // Fallback to entries-only export if backup API fails
      const dataStr = JSON.stringify(entries, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `症状日记_${getLocalDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [entries, utils]);

  const exportCSV = useCallback(() => {
    if (entries.length === 0) return;
    const headers = [
      "日期", "头晕", "头痛", "睡眠质量", "焦虑", "疲劳", "畏光",
       "运动敏感", "心慌", "心情", "头痛发作", "止疼药", "用药", "诱因", "备注",
    ];
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const rows = entries.map((e) => [
      e.date,
      String(e.dizziness),
      String(e.headache),
      String(e.sleepQuality),
      String(e.anxiety),
      String(e.fatigue),
      String(e.photosensitivity),
      String(e.motionSickness),
      String(e.palpitations),
      String(e.mood),
      e.severeHeadache === 0 ? "无" : e.severeHeadache === 1 ? "轻微" : e.severeHeadache === 2 ? "明显" : "严重",
      e.painkillerTaken === 1 ? "是" : "否",
      escapeCSV(formatMedications(e.medications)),
      escapeCSV(Array.isArray(e.triggers) ? e.triggers.join("、") : ""),
      escapeCSV(e.notes ?? ""),
    ]);
    // BOM for Excel UTF-8 compatibility
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

  const importData = useCallback(
    async (jsonStr: string) => {
      try {
        const imported = JSON.parse(jsonStr);
        if (!Array.isArray(imported)) return false;
        // Import each entry via API
        for (const entry of imported) {
          await upsertMutation.mutateAsync({
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
            notes: entry.notes ?? undefined,
          });
        }
        await utils.entries.list.invalidate();
        await utils.entries.painkillerUsage.invalidate();
        return true;
      } catch {
        return false;
      }
    },
    [upsertMutation, utils]
  );

  return {
    entries,
    addEntry,
    deleteEntry,
    getEntryByDate,
    exportData,
    exportCSV,
    importData,
    isLoading: entriesQuery.isLoading,
    isSaving: upsertMutation.isPending,
  };
}
