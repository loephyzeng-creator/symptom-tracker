/**
 * 用药提醒的 localStorage 操作
 */
import { storage, generateId } from "./storage";
import { getEntries } from "./entries";
import { getLocalDateStr } from "@shared/timezone";

export interface MedReminderLocal {
  id: number;
  userId: number;
  medicationName: string;
  dosage: string;
  reminderHour: number;
  reminderMinute: number;
  reminderTimes?: { hour: number; minute: number }[] | null;
  repeatDays?: number[] | null;
  isActive: number;
  offsetMinutes: number;
  snoozedUntil?: string | null;
  stockQuantity?: number | null;
  dailyDosageCount: number;
  stockAlertDays: number;
  lastStockAlertDate?: string | null;
  instructionUrl?: string | null;
  expirationDate?: string | null;
  expirationAlertDays: number;
  lastExpirationAlertDate?: string | null;
  lastNotifiedDate?: string | null;
  lastNotifiedTimeSlots?: number[] | null;
  groupId?: number | null;
  intervalHours?: number | null;
  lastTakenAt?: string | null;
  sortOrder: number;
  startDate?: string | null;
  endDate?: string | null;
  defaultRestockQuantity?: number | null;
  isArchived: number;
  createdAt: string;
  updatedAt: string;
}

export interface MedGroupLocal {
  id: number;
  userId: number;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MedRestockLocal {
  id: number;
  userId: number;
  reminderId: number;
  restockQuantity: number;
  restockDate: string;
  createdAt: string;
}

export interface MedCheckInLocal {
  id: number;
  userId: number;
  reminderId: number;
  date: string;
  timeIndex: number;
  taken: number; // 0=not taken, 1=taken
  takenAt?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Medication Reminders ───────────────────────────────────────────────────

export function getMedReminders(): MedReminderLocal[] {
  return storage.getItem<MedReminderLocal[]>(storage.KEYS.MED_REMINDERS, []);
}

export function saveMedReminders(reminders: MedReminderLocal[]): void {
  storage.setItem(storage.KEYS.MED_REMINDERS, reminders);
}

export function addMedReminder(
  data: Omit<MedReminderLocal, "id" | "userId" | "createdAt" | "updatedAt" | "isArchived">
): MedReminderLocal {
  const reminders = getMedReminders();
  const now = new Date().toISOString();
  const newReminder: MedReminderLocal = {
    ...data,
    id: generateId(),
    userId: 1,
    isArchived: 0,
    createdAt: now,
    updatedAt: now,
  };
  saveMedReminders([...reminders, newReminder]);
  return newReminder;
}

export function updateMedReminder(
  id: number,
  data: Partial<MedReminderLocal>
): MedReminderLocal | null {
  const reminders = getMedReminders();
  const now = new Date().toISOString();
  let updated: MedReminderLocal | null = null;
  const newReminders = reminders.map((r) => {
    if (r.id !== id) return r;
    updated = { ...r, ...data, id, updatedAt: now };
    return updated;
  });
  saveMedReminders(newReminders);
  return updated;
}

export function deleteMedReminder(id: number): void {
  const reminders = getMedReminders();
  saveMedReminders(reminders.filter((r) => r.id !== id));
  // Also delete check-ins for this reminder
  const checkIns = getMedCheckIns();
  saveMedCheckIns(checkIns.filter((c) => c.reminderId !== id));
  // Also delete restocks
  const restocks = getMedRestocks();
  saveMedRestocks(restocks.filter((r) => r.reminderId !== id));
}

export function reorderMedReminders(ids: number[]): void {
  const reminders = getMedReminders();
  const now = new Date().toISOString();
  const newReminders = reminders.map((r) => {
    const idx = ids.indexOf(r.id);
    if (idx === -1) return r;
    return { ...r, sortOrder: idx, updatedAt: now };
  });
  saveMedReminders(newReminders);
}

// ─── Medication Groups ──────────────────────────────────────────────────────

export function getMedGroups(): MedGroupLocal[] {
  return storage.getItem<MedGroupLocal[]>(storage.KEYS.MED_GROUPS, []);
}

export function saveMedGroups(groups: MedGroupLocal[]): void {
  storage.setItem(storage.KEYS.MED_GROUPS, groups);
}

export function createMedGroup(
  data: Omit<MedGroupLocal, "id" | "userId" | "createdAt" | "updatedAt">
): MedGroupLocal {
  const groups = getMedGroups();
  const now = new Date().toISOString();
  const newGroup: MedGroupLocal = {
    ...data,
    id: generateId(),
    userId: 1,
    createdAt: now,
    updatedAt: now,
  };
  saveMedGroups([...groups, newGroup]);
  return newGroup;
}

export function updateMedGroup(
  id: number,
  data: Partial<MedGroupLocal>
): MedGroupLocal | null {
  const groups = getMedGroups();
  const now = new Date().toISOString();
  let updated: MedGroupLocal | null = null;
  const newGroups = groups.map((g) => {
    if (g.id !== id) return g;
    updated = { ...g, ...data, id, updatedAt: now };
    return updated;
  });
  saveMedGroups(newGroups);
  return updated;
}

export function deleteMedGroup(id: number): void {
  const groups = getMedGroups();
  saveMedGroups(groups.filter((g) => g.id !== id));
  // Unassign reminders from this group
  const reminders = getMedReminders();
  const now = new Date().toISOString();
  saveMedReminders(
    reminders.map((r) => (r.groupId === id ? { ...r, groupId: null, updatedAt: now } : r))
  );
}

export function assignMedToGroup(reminderId: number, groupId: number | null): void {
  updateMedReminder(reminderId, { groupId });
}

// ─── Medication Restocks ────────────────────────────────────────────────────

export function getMedRestocks(): MedRestockLocal[] {
  return storage.getItem<MedRestockLocal[]>(storage.KEYS.MED_RESTOCKS, []);
}

export function saveMedRestocks(restocks: MedRestockLocal[]): void {
  storage.setItem(storage.KEYS.MED_RESTOCKS, restocks);
}

export function addMedRestock(
  reminderId: number,
  restockQuantity: number,
  restockDate: string
): MedRestockLocal {
  const restocks = getMedRestocks();
  const now = new Date().toISOString();
  const newRestock: MedRestockLocal = {
    id: generateId(),
    userId: 1,
    reminderId,
    restockQuantity,
    restockDate,
    createdAt: now,
  };
  saveMedRestocks([...restocks, newRestock]);
  return newRestock;
}

export function deleteMedRestock(id: number): void {
  const restocks = getMedRestocks();
  saveMedRestocks(restocks.filter((r) => r.id !== id));
}

// ─── Medication Check-ins ───────────────────────────────────────────────────

export function getMedCheckIns(): MedCheckInLocal[] {
  return storage.getItem<MedCheckInLocal[]>(storage.KEYS.MED_CHECKINS, []);
}

export function saveMedCheckIns(checkIns: MedCheckInLocal[]): void {
  storage.setItem(storage.KEYS.MED_CHECKINS, checkIns);
}

export function confirmMedTaken(
  reminderId: number,
  date: string,
  timeIndex: number,
  note?: string | null
): void {
  const checkIns = getMedCheckIns();
  const now = new Date().toISOString();
  const existing = checkIns.find(
    (c) => c.reminderId === reminderId && c.date === date && c.timeIndex === timeIndex
  );
  if (existing) {
    saveMedCheckIns(
      checkIns.map((c) => {
        if (c.reminderId === reminderId && c.date === date && c.timeIndex === timeIndex) {
          return { ...c, taken: 1, takenAt: now, note: note ?? c.note, updatedAt: now };
        }
        return c;
      })
    );
  } else {
    const newCheckIn: MedCheckInLocal = {
      id: generateId(),
      userId: 1,
      reminderId,
      date,
      timeIndex,
      taken: 1,
      takenAt: now,
      note: note ?? null,
      createdAt: now,
      updatedAt: now,
    };
    saveMedCheckIns([...checkIns, newCheckIn]);
  }
  // Update lastTakenAt on the reminder
  updateMedReminder(reminderId, { lastTakenAt: now });
}

export function unconfirmMedTaken(
  reminderId: number,
  date: string,
  timeIndex: number
): void {
  const checkIns = getMedCheckIns();
  saveMedCheckIns(
    checkIns.map((c) => {
      if (c.reminderId === reminderId && c.date === date && c.timeIndex === timeIndex) {
        return { ...c, taken: 0, takenAt: null, updatedAt: new Date().toISOString() };
      }
      return c;
    })
  );
}

export function getMedCheckInForDate(
  reminderId: number,
  date: string,
  timeIndex: number
): MedCheckInLocal | undefined {
  const checkIns = getMedCheckIns();
  return checkIns.find(
    (c) => c.reminderId === reminderId && c.date === date && c.timeIndex === timeIndex
  );
}

// ─── Helper: isReminderScheduledOnDate ──────────────────────────────────────

export function isReminderScheduledOnDate(
  reminder: { repeatDays?: number[] | null; startDate?: string | null; endDate?: string | null },
  dateStr: string
): boolean {
  if (reminder.startDate && dateStr < reminder.startDate) return false;
  if (reminder.endDate && dateStr > reminder.endDate) return false;
  const dayDate = new Date(dateStr + "T00:00:00");
  const dayOfWeek = dayDate.getDay();
  const days = reminder.repeatDays;
  if (days && Array.isArray(days) && days.length > 0 && !days.includes(dayOfWeek)) return false;
  return true;
}

export function getAllReminderTimes(
  reminder: { reminderHour: number; reminderMinute: number; reminderTimes?: { hour: number; minute: number }[] | null }
): { hour: number; minute: number }[] {
  if (
    reminder.reminderTimes &&
    Array.isArray(reminder.reminderTimes) &&
    reminder.reminderTimes.length > 0
  ) {
    return [...reminder.reminderTimes].sort(
      (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
    );
  }
  return [{ hour: reminder.reminderHour, minute: reminder.reminderMinute }];
}

// ─── Today Medications ──────────────────────────────────────────────────────

export function getTodayMedications(dateStr?: string) {
  const today = dateStr ?? getLocalDateStr();
  const reminders = getMedReminders().filter(
    (r) => r.isActive === 1 && r.isArchived === 0 && isReminderScheduledOnDate(r, today)
  );
  const checkIns = getMedCheckIns().filter((c) => c.date === today);
  const groups = getMedGroups();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  return reminders.map((r) => {
    const times = getAllReminderTimes(r);
    const takenSlots = checkIns
      .filter((c) => c.reminderId === r.id && c.taken === 1)
      .map((c) => c.timeIndex);

    return {
      ...r,
      times,
      takenSlots,
      group: r.groupId ? groupMap.get(r.groupId) ?? null : null,
    };
  });
}

// ─── Stock Status ───────────────────────────────────────────────────────────

export function getMedStockStatus() {
  const reminders = getMedReminders().filter((r) => r.isArchived === 0);
  const restocks = getMedRestocks();
  const checkIns = getMedCheckIns();
  const today = getLocalDateStr();

  return reminders.map((r) => {
    if (r.stockQuantity === null || r.stockQuantity === undefined) {
      return { ...r, currentStock: null, daysRemaining: null };
    }

    // Find latest restock
    const myRestocks = restocks
      .filter((rs) => rs.reminderId === r.id)
      .sort((a, b) => b.restockDate.localeCompare(a.restockDate));
    const latestRestock = myRestocks[0];

    let currentStock = r.stockQuantity;
    if (latestRestock) {
      // Count usage since last restock
      const usageSinceRestock = checkIns.filter(
        (c) => c.reminderId === r.id && c.date >= latestRestock.restockDate && c.taken === 1
      ).length;
      currentStock = Math.max(0, latestRestock.restockQuantity - usageSinceRestock);
    }

    const dailyUsage = r.dailyDosageCount || 1;
    const daysRemaining = dailyUsage > 0 ? Math.floor(currentStock / dailyUsage) : null;

    return { ...r, currentStock, daysRemaining };
  });
}

// ─── Adherence ──────────────────────────────────────────────────────────────

export function getMedAdherence(startDate: string, endDate: string) {
  const reminders = getMedReminders().filter((r) => r.isArchived === 0 && r.isActive === 1);
  const checkIns = getMedCheckIns();

  // Build date range
  const dates: string[] = [];
  const d = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  const perMed = reminders.map((r) => {
    const times = getAllReminderTimes(r);
    const scheduled = dates.filter((date) => isReminderScheduledOnDate(r, date));
    const totalDoses = scheduled.length * times.length;
    const takenDoses = checkIns.filter(
      (c) =>
        c.reminderId === r.id &&
        c.date >= startDate &&
        c.date <= endDate &&
        c.taken === 1
    ).length;
    const rate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
    return {
      id: r.id,
      medicationName: r.medicationName,
      dosage: r.dosage,
      totalDoses,
      takenDoses,
      adherenceRate: rate,
    };
  });

  const totalDoses = perMed.reduce((s, m) => s + m.totalDoses, 0);
  const takenDoses = perMed.reduce((s, m) => s + m.takenDoses, 0);
  const overallRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  // Daily breakdown
  const dailyData = dates.map((date) => {
    const dayScheduled = reminders.filter((r) => isReminderScheduledOnDate(r, date));
    const dayTotal = dayScheduled.reduce(
      (s, r) => s + getAllReminderTimes(r).length,
      0
    );
    const dayTaken = checkIns.filter(
      (c) => c.date === date && c.taken === 1
    ).length;
    return {
      date,
      total: dayTotal,
      taken: dayTaken,
      rate: dayTotal > 0 ? Math.round((dayTaken / dayTotal) * 100) : 0,
    };
  });

  return { perMed, overallRate, totalDoses, takenDoses, dailyData };
}

// ─── Check-in Calendar ──────────────────────────────────────────────────────

export function getMedCheckInCalendar(year: number, month: number) {
  const reminders = getMedReminders().filter((r) => r.isArchived === 0);
  const checkIns = getMedCheckIns();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

  const dates: string[] = [];
  const d = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  return dates.map((date) => {
    const scheduled = reminders.filter(
      (r) => r.isActive === 1 && isReminderScheduledOnDate(r, date)
    );
    const totalDoses = scheduled.reduce(
      (s, r) => s + getAllReminderTimes(r).length,
      0
    );
    const takenDoses = checkIns.filter(
      (c) => c.date === date && c.taken === 1
    ).length;
    return {
      date,
      totalDoses,
      takenDoses,
      completionRate: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
    };
  });
}

// ─── Completion by Dates ─────────────────────────────────────────────────────

export function getMedCompletionByDates(dates: string[]) {
  const reminders = getMedReminders().filter((r) => r.isArchived === 0 && r.isActive === 1);
  const checkIns = getMedCheckIns();

  return dates.map((date) => {
    const scheduled = reminders.filter((r) => isReminderScheduledOnDate(r, date));
    const totalDoses = scheduled.reduce(
      (s, r) => s + getAllReminderTimes(r).length,
      0
    );
    const takenDoses = checkIns.filter(
      (c) => c.date === date && c.taken === 1
    ).length;
    return {
      date,
      totalDoses,
      takenDoses,
      completionRate: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
    };
  });
}

// ─── Monthly Consumption ─────────────────────────────────────────────────────

export function getMonthlyMedConsumption(months: number = 6) {
  const checkIns = getMedCheckIns().filter((c) => c.taken === 1);
  const reminders = getMedReminders();
  const reminderMap = new Map(reminders.map((r) => [r.id, r]));

  const today = new Date();
  const result: Array<{ month: string; label: string; medications: Record<string, number> }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}月`;
    const medications: Record<string, number> = {};

    checkIns
      .filter((c) => c.date.startsWith(monthStr))
      .forEach((c) => {
        const r = reminderMap.get(c.reminderId);
        if (r) {
          medications[r.medicationName] = (medications[r.medicationName] ?? 0) + 1;
        }
      });

    result.push({ month: monthStr, label, medications });
  }

  return result;
}

// ─── Drug Interactions ───────────────────────────────────────────────────────

export interface DrugInteractionLocal {
  id: number;
  userId: number;
  drugA: string;
  drugB: string;
  severity: "mild" | "moderate" | "severe";
  description: string;
  recommendation?: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export function getDrugInteractions(): DrugInteractionLocal[] {
  return storage.getItem<DrugInteractionLocal[]>(storage.KEYS.DRUG_INTERACTIONS, []);
}

export function saveDrugInteractions(interactions: DrugInteractionLocal[]): void {
  storage.setItem(storage.KEYS.DRUG_INTERACTIONS, interactions);
}

export function addDrugInteraction(
  data: Omit<DrugInteractionLocal, "id" | "userId" | "createdAt" | "updatedAt">
): DrugInteractionLocal {
  const interactions = getDrugInteractions();
  const now = new Date().toISOString();
  const newInteraction: DrugInteractionLocal = {
    ...data,
    id: generateId(),
    userId: 1,
    createdAt: now,
    updatedAt: now,
  };
  saveDrugInteractions([...interactions, newInteraction]);
  return newInteraction;
}

// ─── Medication Timeline ─────────────────────────────────────────────────────

export function getMedTimeline(reminderId: number, startDate: string, endDate: string) {
  const checkIns = getMedCheckIns().filter(
    (c) => c.reminderId === reminderId && c.date >= startDate && c.date <= endDate
  );
  const reminder = getMedReminders().find((r) => r.id === reminderId);
  if (!reminder) return [];

  const dates: string[] = [];
  const d = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  return dates
    .filter((date) => isReminderScheduledOnDate(reminder, date))
    .map((date) => {
      const times = getAllReminderTimes(reminder);
      const dayCheckIns = checkIns.filter((c) => c.date === date);
      return {
        date,
        times: times.map((t, idx) => ({
          ...t,
          timeIndex: idx,
          taken: dayCheckIns.some((c) => c.timeIndex === idx && c.taken === 1),
          takenAt: dayCheckIns.find((c) => c.timeIndex === idx)?.takenAt ?? null,
        })),
      };
    });
}

// ─── Day Detail ──────────────────────────────────────────────────────────────

export function getMedCheckInDayDetail(date: string) {
  const reminders = getMedReminders().filter(
    (r) => r.isActive === 1 && r.isArchived === 0 && isReminderScheduledOnDate(r, date)
  );
  const checkIns = getMedCheckIns().filter((c) => c.date === date);
  const groups = getMedGroups();
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  return reminders.map((r) => {
    const times = getAllReminderTimes(r);
    return {
      ...r,
      group: r.groupId ? groupMap.get(r.groupId) ?? null : null,
      times: times.map((t, idx) => ({
        ...t,
        timeIndex: idx,
        taken: checkIns.some((c) => c.reminderId === r.id && c.timeIndex === idx && c.taken === 1),
        takenAt:
          checkIns.find((c) => c.reminderId === r.id && c.timeIndex === idx)?.takenAt ?? null,
        note: checkIns.find((c) => c.reminderId === r.id && c.timeIndex === idx)?.note ?? null,
      })),
    };
  });
}

// ─── Missed Alerts ───────────────────────────────────────────────────────────

export function getMissedMedAlerts(lookbackDays: number = 3) {
  const today = getLocalDateStr();
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - lookbackDays);
  const startDate = d.toISOString().slice(0, 10);

  const reminders = getMedReminders().filter((r) => r.isActive === 1 && r.isArchived === 0);
  const checkIns = getMedCheckIns();

  const alerts: Array<{
    reminderId: number;
    medicationName: string;
    date: string;
    timeIndex: number;
    hour: number;
    minute: number;
  }> = [];

  const dates: string[] = [];
  const dIter = new Date(startDate + "T00:00:00");
  const endDate = new Date(today + "T00:00:00");
  endDate.setDate(endDate.getDate() - 1); // exclude today
  while (dIter <= endDate) {
    dates.push(dIter.toISOString().slice(0, 10));
    dIter.setDate(dIter.getDate() + 1);
  }

  for (const reminder of reminders) {
    for (const date of dates) {
      if (!isReminderScheduledOnDate(reminder, date)) continue;
      const times = getAllReminderTimes(reminder);
      times.forEach((t, idx) => {
        const taken = checkIns.some(
          (c) => c.reminderId === reminder.id && c.date === date && c.timeIndex === idx && c.taken === 1
        );
        if (!taken) {
          alerts.push({
            reminderId: reminder.id,
            medicationName: reminder.medicationName,
            date,
            timeIndex: idx,
            hour: t.hour,
            minute: t.minute,
          });
        }
      });
    }
  }

  return alerts;
}

// ─── Archived Stats ──────────────────────────────────────────────────────────

export function getArchivedMedStats() {
  const reminders = getMedReminders().filter((r) => r.isArchived === 1);
  const checkIns = getMedCheckIns();

  return reminders.map((r) => {
    const myCheckIns = checkIns.filter((c) => c.reminderId === r.id && c.taken === 1);
    const totalTaken = myCheckIns.length;
    const firstDate = myCheckIns.length > 0
      ? myCheckIns.sort((a, b) => a.date.localeCompare(b.date))[0].date
      : null;
    const lastDate = myCheckIns.length > 0
      ? myCheckIns.sort((a, b) => b.date.localeCompare(a.date))[0].date
      : null;
    return { ...r, totalTaken, firstDate, lastDate };
  });
}

// ─── Grouped Medications ─────────────────────────────────────────────────────

export function getGroupedMedications() {
  const reminders = getMedReminders().filter((r) => r.isArchived === 0);
  const groups = getMedGroups();
  const today = getLocalDateStr();
  const checkIns = getMedCheckIns().filter((c) => c.date === today);

  const grouped: Record<
    number | "ungrouped",
    { group: MedGroupLocal | null; reminders: typeof reminders }
  > = { ungrouped: { group: null, reminders: [] } };

  groups.forEach((g) => {
    grouped[g.id] = { group: g, reminders: [] };
  });

  reminders.forEach((r) => {
    const key = r.groupId ?? "ungrouped";
    if (!grouped[key]) {
      grouped[key] = { group: null, reminders: [] };
    }
    grouped[key].reminders.push(r);
  });

  return Object.values(grouped)
    .filter((g) => g.reminders.length > 0 || g.group !== null)
    .map((g) => ({
      ...g,
      reminders: g.reminders.map((r) => {
        const times = getAllReminderTimes(r);
        const takenSlots = checkIns
          .filter((c) => c.reminderId === r.id && c.taken === 1)
          .map((c) => c.timeIndex);
        return { ...r, times, takenSlots };
      }),
    }));
}

export function confirmAllInGroup(groupId: number, date: string): void {
  const reminders = getMedReminders().filter(
    (r) => r.groupId === groupId && r.isActive === 1 && r.isArchived === 0 && isReminderScheduledOnDate(r, date)
  );
  reminders.forEach((r) => {
    const times = getAllReminderTimes(r);
    times.forEach((_, idx) => {
      confirmMedTaken(r.id, date, idx);
    });
  });
}

// ─── Batch Operations ────────────────────────────────────────────────────────

export function batchUpdateMedReminders(
  ids: number[],
  data: Partial<MedReminderLocal>
): void {
  const reminders = getMedReminders();
  const now = new Date().toISOString();
  saveMedReminders(
    reminders.map((r) => (ids.includes(r.id) ? { ...r, ...data, id: r.id, updatedAt: now } : r))
  );
}

export function batchDeleteMedReminders(ids: number[]): void {
  const reminders = getMedReminders();
  saveMedReminders(reminders.filter((r) => !ids.includes(r.id)));
  const checkIns = getMedCheckIns();
  saveMedCheckIns(checkIns.filter((c) => !ids.includes(c.reminderId)));
  const restocks = getMedRestocks();
  saveMedRestocks(restocks.filter((r) => !ids.includes(r.reminderId)));
}

export function batchRestockMedications(
  items: Array<{ reminderId: number; restockQuantity: number; restockDate: string }>
): void {
  items.forEach(({ reminderId, restockQuantity, restockDate }) => {
    addMedRestock(reminderId, restockQuantity, restockDate);
  });
}

// ─── Interval Medication Status ──────────────────────────────────────────────

export function getIntervalMedStatus() {
  const reminders = getMedReminders().filter(
    (r) => r.isActive === 1 && r.isArchived === 0 && r.intervalHours !== null && r.intervalHours !== undefined
  );
  const now = new Date();

  return reminders.map((r) => {
    const intervalHours = r.intervalHours!;
    const lastTakenAt = r.lastTakenAt ? new Date(r.lastTakenAt) : null;
    let nextDoseAt: Date | null = null;
    let minutesUntil: number | null = null;

    if (lastTakenAt) {
      nextDoseAt = new Date(lastTakenAt.getTime() + intervalHours * 60 * 60 * 1000);
      minutesUntil = Math.round((nextDoseAt.getTime() - now.getTime()) / (1000 * 60));
    }

    return {
      ...r,
      nextDoseAt: nextDoseAt?.toISOString() ?? null,
      minutesUntil,
      isDue: minutesUntil !== null ? minutesUntil <= 0 : true,
    };
  });
}

// ─── Medication History ──────────────────────────────────────────────────────

export function getMedHistory() {
  const entries = getEntries();
  const allMeds: string[] = [];
  entries.forEach((e) => {
    if (Array.isArray(e.medications)) {
      e.medications.forEach((m) => {
        if (m.name && !allMeds.includes(m.name)) {
          allMeds.push(m.name);
        }
      });
    }
  });
  return allMeds;
}

// ─── Stock Change Log ────────────────────────────────────────────────────────

export function getStockChangeLog(reminderId: number) {
  const restocks = getMedRestocks()
    .filter((r) => r.reminderId === reminderId)
    .sort((a, b) => b.restockDate.localeCompare(a.restockDate));
  const checkIns = getMedCheckIns()
    .filter((c) => c.reminderId === reminderId && c.taken === 1)
    .sort((a, b) => b.date.localeCompare(a.date));

  const log: Array<{
    type: "restock" | "usage";
    date: string;
    quantity: number;
    note?: string;
  }> = [];

  restocks.forEach((r) => {
    log.push({ type: "restock", date: r.restockDate, quantity: r.restockQuantity });
  });

  checkIns.forEach((c) => {
    log.push({ type: "usage", date: c.date, quantity: -1, note: c.note ?? undefined });
  });

  return log.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
}
