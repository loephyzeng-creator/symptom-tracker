/**
 * Helper to build a unified medication matching map from symptom entry medications.
 * Supports matching by reminderId + timeIndex (preferred) or medication name (fallback).
 */

type MedEntry = { name: string; dosage: string; reminderId?: number; timeIndex?: number };

export interface MedMatchInfo {
  names: Set<string>;
  reminderIds: Set<number>;
  /** Set of "reminderId:timeIndex" keys for multi-dose matching */
  reminderTimeKeys: Set<string>;
}

/**
 * Build a composite key for reminderId + timeIndex matching.
 */
function makeReminderTimeKey(reminderId: number, timeIndex?: number): string {
  return timeIndex !== undefined && timeIndex !== null
    ? `${reminderId}:${timeIndex}`
    : `${reminderId}`;
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
    const reminderTimeKeys = new Set<string>();
    if (Array.isArray(meds)) {
      for (const m of meds as MedEntry[]) {
        if (m.name && m.name.trim()) {
          names.add(m.name.trim().toLowerCase());
        }
        if (m.reminderId) {
          reminderIds.add(m.reminderId);
          reminderTimeKeys.add(makeReminderTimeKey(m.reminderId, m.timeIndex));
        }
      }
    }
    entryMap.set(entry.date, { names, reminderIds, reminderTimeKeys });
  }
  return entryMap;
}

/**
 * Check if a specific medication reminder was taken on a given date.
 * Prefers reminderId match, falls back to name match.
 * For multi-dose reminders, checks timeIndex if provided.
 */
export function wasMedTaken(
  recorded: MedMatchInfo | undefined,
  reminderId: number,
  medName: string,
  timeIndex?: number
): boolean {
  if (!recorded) return false;

  // For multi-dose: check specific timeIndex key first
  if (timeIndex !== undefined && timeIndex !== null) {
    const key = makeReminderTimeKey(reminderId, timeIndex);
    if (recorded.reminderTimeKeys.has(key)) return true;
    // Don't fall back to just reminderId for multi-dose — each dose is independent
    return false;
  }

  // Single-dose: prefer reminderId match
  if (recorded.reminderIds.has(reminderId)) return true;
  // Fallback to name match
  return recorded.names.has(medName.trim().toLowerCase());
}
