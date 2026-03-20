import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

export interface MedicationItem {
  name: string;
  dosage: string;
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
    },
  });

  const deleteMutation = trpc.entries.delete.useMutation({
    onSuccess: () => {
      utils.entries.list.invalidate();
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
      await upsertMutation.mutateAsync({
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
        notes: entry.notes ?? undefined,
      });
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
            notes: entry.notes ?? undefined,
          });
        }
        await utils.entries.list.invalidate();
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
    importData,
    isLoading: entriesQuery.isLoading,
    isSaving: upsertMutation.isPending,
  };
}
