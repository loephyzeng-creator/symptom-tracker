/**
 * Helper to build a unified medication matching map from symptom entry medications.
 * Supports matching by reminderId (preferred) or medication name (fallback).
 */

type MedEntry = { name: string; dosage: string; reminderId?: number };

export interface MedMatchInfo {
  names: Set<string>;
  reminderIds: Set<number>;
}

/**
 * Build a map of date -> MedMatchInfo from symptom entries.
 * Used by calendar, timeline, adherence, and day-detail functions.
 */
export function buildEntryMedMap(
  entries: Array<{ date: string; medications: unknown }>
): Map<string, MedMatchInfo> {
  const entryMap = new Map<string, MedMatchInfo>();
  for (const entry of entries) {
    const meds = entry.medications;
    const names = new Set<string>();
    const reminderIds = new Set<number>();
    if (Array.isArray(meds)) {
      for (const m of meds as MedEntry[]) {
        if (m.name && m.name.trim()) {
          names.add(m.name.trim().toLowerCase());
        }
        if (m.reminderId) {
          reminderIds.add(m.reminderId);
        }
      }
    }
    entryMap.set(entry.date, { names, reminderIds });
  }
  return entryMap;
}

/**
 * Check if a specific medication reminder was taken on a given date.
 * Prefers reminderId match, falls back to name match.
 */
export function wasMedTaken(
  recorded: MedMatchInfo | undefined,
  reminderId: number,
  medName: string
): boolean {
  if (!recorded) return false;
  // Prefer reminderId match
  if (recorded.reminderIds.has(reminderId)) return true;
  // Fallback to name match
  return recorded.names.has(medName.trim().toLowerCase());
}
