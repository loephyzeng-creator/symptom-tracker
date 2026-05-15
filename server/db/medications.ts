/**
 * Medication Reminders, Stock Management, Groups, Drug Interactions, and related helpers.
 * Extracted from server/db.ts for maintainability.
 */
import { and, eq, desc, gte, lte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  symptomEntries,
  medicationReminders,
  medicationGroups,
  drugInteractions,
  medicationRestocks,
  notificationSettings,
} from "../../drizzle/schema";
import { getDb } from "./connection";
import { getEntryByUserAndDate } from "./symptomEntries";
import { getPushSubscriptionsByUserId, removePushSubscription, getNotificationSoundForUser } from "./notifications";
import { buildEntryMedMap, wasMedTaken } from "../medMatchHelper";
import { getDateStrInTimezone, DEFAULT_TIMEZONE } from "../../shared/timezone";
import { ENV } from "../_core/env";

// ─── Helper: isReminderScheduledOnDate ──────────────────────────────────

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

export function getAllReminderTimes(reminder: { reminderHour: number; reminderMinute: number; reminderTimes?: {hour: number; minute: number}[] | null }): {hour: number; minute: number}[] {
  if (reminder.reminderTimes && Array.isArray(reminder.reminderTimes) && reminder.reminderTimes.length > 0) {
    return [...reminder.reminderTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }
  return [{ hour: reminder.reminderHour, minute: reminder.reminderMinute }];
}

/**
 * Date-aware version of getAllReminderTimes.
 * If the reminder has a timesChangedDate and the queried date is BEFORE that date,
 * use the previousReminderTimes (or fall back to single primary time) instead of
 * the current reminderTimes. This prevents retroactive application of frequency changes.
 */
export function getAllReminderTimesForDate(
  reminder: {
    reminderHour: number; reminderMinute: number;
    reminderTimes?: {hour: number; minute: number}[] | null;
    timesChangedDate?: string | null;
    previousReminderTimes?: {hour: number; minute: number}[] | null;
  },
  dateStr: string
): {hour: number; minute: number}[] {
  // If there's a timesChangedDate and the queried date is before it, use old config
  if (reminder.timesChangedDate && dateStr < reminder.timesChangedDate) {
    if (reminder.previousReminderTimes && Array.isArray(reminder.previousReminderTimes) && reminder.previousReminderTimes.length > 0) {
      return [...reminder.previousReminderTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    }
    // No previous times recorded — fall back to single primary time
    return [{ hour: reminder.reminderHour, minute: reminder.reminderMinute }];
  }
  // Otherwise use current times
  return getAllReminderTimes(reminder);
}

export function getNextIntervalDoseTime(
  intervalHours: number | null,
  lastTakenAt: string | null
): { nextDoseAt: Date; minutesUntil: number } | null {
  if (!intervalHours) return null;
  const now = new Date();
  if (!lastTakenAt) return { nextDoseAt: now, minutesUntil: 0 };
  const lastTaken = new Date(lastTakenAt);
  const nextDoseAt = new Date(lastTaken.getTime() + intervalHours * 60 * 60 * 1000);
  const minutesUntil = Math.round((nextDoseAt.getTime() - now.getTime()) / (1000 * 60));
  return { nextDoseAt, minutesUntil };
}

// ─── Stock Internal Helpers ──────────────────────────────────────────

async function countMedicationUsageSince(
  db: ReturnType<typeof drizzle>,
  userId: number,
  reminderId: number,
  medicationName: string,
  sinceDate: string
): Promise<number> {
  const entries = await db
    .select({ medications: symptomEntries.medications, date: symptomEntries.date })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, sinceDate)));

  let count = 0;
  for (const entry of entries) {
    const meds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] =
      Array.isArray(entry.medications) ? entry.medications : [];
    for (const m of meds) {
      if (m.reminderId === reminderId || m.name.toLowerCase() === medicationName.toLowerCase()) count++;
    }
  }
  return count;
}

async function getLatestRestock(db: ReturnType<typeof drizzle>, reminderId: number) {
  const rows = await db.select().from(medicationRestocks).where(eq(medicationRestocks.reminderId, reminderId)).orderBy(desc(medicationRestocks.createdAt)).limit(1);
  return rows[0] ?? null;
}

async function getAllRestocks(db: ReturnType<typeof drizzle>, reminderId: number) {
  return db.select().from(medicationRestocks).where(eq(medicationRestocks.reminderId, reminderId)).orderBy(medicationRestocks.restockDate);
}

async function countTotalMedicationUsage(
  db: ReturnType<typeof drizzle>, userId: number, reminderId: number, medicationName: string, sinceDate: string
): Promise<number> {
  return countMedicationUsageSince(db, userId, reminderId, medicationName, sinceDate);
}

// ─── Stock Computation ──────────────────────────────────────────

export async function computeRealTimeStock(
  userId: number,
  reminder: { id: number; medicationName: string; stockQuantity: number | null; dailyDosageCount: number | null; createdAt?: Date | null }
): Promise<number | null> {
  const db = await getDb();
  if (!db) return reminder.stockQuantity;

  const baseDate = reminder.createdAt
    ? getDateStrInTimezone(DEFAULT_TIMEZONE, reminder.createdAt)
    : "2020-01-01";

  const allRestocksData = await getAllRestocks(db, reminder.id);
  if (allRestocksData.length === 0) {
    if (reminder.stockQuantity === null) return null;
    const totalUsage = await countMedicationUsageSince(db, userId, reminder.id, reminder.medicationName, baseDate);
    return Math.max(0, reminder.stockQuantity - totalUsage);
  }

  const initialStock = reminder.stockQuantity ?? 0;
  const totalRestocked = allRestocksData.reduce((sum, r) => sum + r.restockQuantity, 0);
  const totalUsage = await countMedicationUsageSince(db, userId, reminder.id, reminder.medicationName, baseDate);
  return Math.max(0, initialStock + totalRestocked - totalUsage);
}

// ─── Medication Reminders CRUD ──────────────────────────────────────────

export async function getMedicationReminders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const reminders = await db.select().from(medicationReminders)
    .where(eq(medicationReminders.userId, userId))
    .orderBy(medicationReminders.sortOrder, medicationReminders.reminderHour, medicationReminders.reminderMinute);

  const results = [];
  for (const r of reminders) {
    const realStock = await computeRealTimeStock(userId, r);
    results.push({ ...r, stockQuantity: realStock });
  }
  return results;
}

export async function reorderMedicationReminders(userId: number, orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(medicationReminders).set({ sortOrder: i })
      .where(and(eq(medicationReminders.id, orderedIds[i]), eq(medicationReminders.userId, userId)));
  }
}

export async function addMedicationReminder(
  userId: number,
  data: {
    medicationName: string; dosage: string; reminderHour: number; reminderMinute: number;
    reminderTimes?: {hour: number; minute: number}[] | null; repeatDays?: number[] | null;
    offsetMinutes?: number; stockQuantity?: number | null; dailyDosageCount?: number;
    stockAlertDays?: number; instructionUrl?: string | null; expirationDate?: string | null;
    expirationAlertDays?: number; groupId?: number | null; intervalHours?: number | null;
    startDate?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return null;
  const times = data.reminderTimes;
  const effectiveDailyDosageCount = times && times.length > 0 ? times.length : (data.dailyDosageCount ?? 1);
  const [result] = await db.insert(medicationReminders).values({
    userId, medicationName: data.medicationName, dosage: data.dosage,
    reminderHour: data.reminderHour, reminderMinute: data.reminderMinute,
    reminderTimes: times ?? null, repeatDays: data.repeatDays ?? [0, 1, 2, 3, 4, 5, 6],
    offsetMinutes: data.offsetMinutes ?? 0, stockQuantity: data.stockQuantity ?? null,
    dailyDosageCount: effectiveDailyDosageCount, stockAlertDays: data.stockAlertDays ?? 7,
    instructionUrl: data.instructionUrl ?? null, expirationDate: data.expirationDate ?? null,
    expirationAlertDays: data.expirationAlertDays ?? 30, groupId: data.groupId ?? null,
    intervalHours: data.intervalHours ?? null, startDate: data.startDate ?? null, enabled: 1,
  });
  return { id: result.insertId };
}

export async function updateMedicationReminder(
  id: number, userId: number,
  data: Partial<{
    medicationName: string; dosage: string; reminderHour: number; reminderMinute: number;
    reminderTimes: {hour: number; minute: number}[] | null; enabled: number;
    repeatDays: number[] | null; offsetMinutes: number; snoozedUntil: string | null;
    stockQuantity: number | null; dailyDosageCount: number; stockAlertDays: number;
    expirationDate: string | null; expirationAlertDays: number; groupId: number | null;
    intervalHours: number | null; startDate: string | null;
    endDate: string | null; defaultRestockQuantity: number | null;
  }>
) {
  const db = await getDb();
  if (!db) return;

  // If reminderTimes is being changed, snapshot the old times and record the change date
  if (data.reminderTimes !== undefined) {
    const existing = await db.select({
      reminderTimes: medicationReminders.reminderTimes,
      reminderHour: medicationReminders.reminderHour,
      reminderMinute: medicationReminders.reminderMinute,
    }).from(medicationReminders)
      .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId))).limit(1);

    if (existing.length > 0) {
      const oldTimes = existing[0].reminderTimes;
      const newTimes = data.reminderTimes;
      // Check if the number of times actually changed
      const oldCount = (oldTimes && Array.isArray(oldTimes) && oldTimes.length > 0) ? oldTimes.length : 1;
      const newCount = (newTimes && Array.isArray(newTimes) && newTimes.length > 0) ? newTimes.length : 1;
      if (oldCount !== newCount) {
        const todayStr = new Date().toISOString().slice(0, 10);
        (data as any).timesChangedDate = todayStr;
        (data as any).previousReminderTimes = oldTimes || [{ hour: existing[0].reminderHour, minute: existing[0].reminderMinute }];
      }
    }
  }

  await db.update(medicationReminders).set(data)
    .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId)));
}

export async function deleteMedicationReminder(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(medicationReminders)
    .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId)));
}

// ─── Medication Notification Helpers ──────────────────────────────────────

export async function getMedicationRemindersToSend(todayStr: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: medicationReminders.id, userId: medicationReminders.userId,
    medicationName: medicationReminders.medicationName, dosage: medicationReminders.dosage,
    reminderHour: medicationReminders.reminderHour, reminderMinute: medicationReminders.reminderMinute,
    reminderTimes: medicationReminders.reminderTimes, repeatDays: medicationReminders.repeatDays,
    offsetMinutes: medicationReminders.offsetMinutes, snoozedUntil: medicationReminders.snoozedUntil,
    lastNotifiedDate: medicationReminders.lastNotifiedDate, lastNotifiedTimeSlots: medicationReminders.lastNotifiedTimeSlots,
    startDate: medicationReminders.startDate, endDate: medicationReminders.endDate,
    notificationSound: notificationSettings.notificationSound, timezone: notificationSettings.timezone,
  }).from(medicationReminders)
    .leftJoin(notificationSettings, eq(medicationReminders.userId, notificationSettings.userId))
    .where(eq(medicationReminders.enabled, 1));
}

export async function snoozeMedicationReminder(id: number, userId: number, snoozeUntil: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicationReminders).set({ snoozedUntil: snoozeUntil, lastNotifiedDate: null })
    .where(and(eq(medicationReminders.id, id), eq(medicationReminders.userId, userId)));
}

export async function clearMedicationSnooze(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicationReminders).set({ snoozedUntil: null }).where(eq(medicationReminders.id, id));
}

export async function markMedicationReminderNotified(id: number, todayStr: string, timeSlotIndex?: number) {
  const db = await getDb();
  if (!db) return;
  if (timeSlotIndex !== undefined) {
    const existing = await db.select({ lastNotifiedDate: medicationReminders.lastNotifiedDate, lastNotifiedTimeSlots: medicationReminders.lastNotifiedTimeSlots })
      .from(medicationReminders).where(eq(medicationReminders.id, id)).limit(1);
    let slots: number[] = [];
    if (existing.length > 0 && existing[0].lastNotifiedDate === todayStr && existing[0].lastNotifiedTimeSlots) {
      slots = existing[0].lastNotifiedTimeSlots as number[];
    }
    if (!slots.includes(timeSlotIndex)) slots.push(timeSlotIndex);
    await db.update(medicationReminders).set({ lastNotifiedDate: todayStr, lastNotifiedTimeSlots: slots }).where(eq(medicationReminders.id, id));
  } else {
    await db.update(medicationReminders).set({ lastNotifiedDate: todayStr, lastNotifiedTimeSlots: null }).where(eq(medicationReminders.id, id));
  }
}

// ─── Missed Medication Alerts ──────────────────────────────────────────

export async function getMissedMedicationAlerts(
  userId: number, threshold: number = 3
): Promise<Array<{ reminderId: number; medicationName: string; dosage: string; missedDays: number }>> {
  const db = await getDb();
  if (!db) return [];
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));
  if (reminders.length === 0) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, startStr), lte(symptomEntries.date, endStr)));

  const entryMap = new Map<string, Set<string>>();
  for (const entry of entries) {
    const meds = entry.medications;
    const names = new Set<string>();
    if (Array.isArray(meds)) { for (const m of meds) { if (m.name && m.name.trim()) names.add(m.name.trim().toLowerCase()); } }
    entryMap.set(entry.date, names);
  }

  const alerts: Array<{ reminderId: number; medicationName: string; dosage: string; missedDays: number }> = [];
  for (const reminder of reminders) {
    let consecutiveMissed = 0;
    const medName = reminder.medicationName.trim().toLowerCase();
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      if (!isReminderScheduledOnDate(reminder, dateStr)) continue;
      const recordedMeds = entryMap.get(dateStr);
      if (recordedMeds && recordedMeds.has(medName)) break;
      consecutiveMissed++;
    }
    if (consecutiveMissed >= threshold) {
      alerts.push({ reminderId: reminder.id, medicationName: reminder.medicationName, dosage: reminder.dosage, missedDays: consecutiveMissed });
    }
  }
  return alerts;
}

// ─── Medication Adherence Statistics ──────────────────────────────────

export async function getMedicationAdherence(userId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return { overallRate: 0, perMedication: [], dailyData: [] };

  const reminders = await db.select().from(medicationReminders).where(eq(medicationReminders.userId, userId));
  if (reminders.length === 0) return { overallRate: 0, perMedication: [], dailyData: [] };

  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, startDate), lte(symptomEntries.date, endDate)))
    .orderBy(symptomEntries.date);

  const entryMap = buildEntryMedMap(entries);
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  const perMedMap = new Map<string, { name: string; expected: number; taken: number }>();
  const dailyData: Array<{ date: string; expected: number; taken: number; rate: number }> = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    let dayExpected = 0, dayTaken = 0;

    for (const reminder of reminders) {
      if (!isReminderScheduledOnDate(reminder, dateStr)) continue;
      // Use date-aware times to count expected doses correctly
      const timesForDate = getAllReminderTimesForDate(reminder, dateStr);
      const numDoses = timesForDate.length;
      dayExpected += numDoses;
      const medName = reminder.medicationName.trim().toLowerCase();
      const recordedMeds = entryMap.get(dateStr);
      // Count how many dose slots were actually taken
      let medTaken = 0;
      if (numDoses === 1) {
        if (wasMedTaken(recordedMeds, reminder.id, reminder.medicationName)) medTaken = 1;
      } else {
        for (let ti = 0; ti < numDoses; ti++) {
          if (wasMedTaken(recordedMeds, reminder.id, reminder.medicationName, ti)) medTaken++;
        }
      }
      dayTaken += medTaken;

      const existing = perMedMap.get(medName);
      if (existing) { existing.expected += numDoses; existing.taken += medTaken; }
      else { perMedMap.set(medName, { name: reminder.medicationName, expected: numDoses, taken: medTaken }); }
    }

    if (dayExpected > 0) dailyData.push({ date: dateStr, expected: dayExpected, taken: dayTaken, rate: Math.round((dayTaken / dayExpected) * 100) });
  }

  const totalExpected = dailyData.reduce((s, d) => s + d.expected, 0);
  const totalTaken = dailyData.reduce((s, d) => s + d.taken, 0);
  const overallRate = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;
  const perMedication = Array.from(perMedMap.values()).map((m) => ({
    name: m.name, expected: m.expected, taken: m.taken,
    rate: m.expected > 0 ? Math.round((m.taken / m.expected) * 100) : 0,
  }));

  return { overallRate, perMedication, dailyData };
}

// ─── Stock Management ──────────────────────────────────────────

export async function getMedicationStockStatus(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const reminders = await db.select().from(medicationReminders).where(eq(medicationReminders.userId, userId));
  const results = [];
  for (const r of reminders) {
    const latestRestock = await getLatestRestock(db, r.id);
    const hasStockTracking = latestRestock !== null || r.stockQuantity !== null;
    if (!hasStockTracking) continue;
    const realStock = await computeRealTimeStock(userId, r);
    if (realStock === null) continue;
    const dailyCount = r.dailyDosageCount ?? 1;
    const daysRemaining = dailyCount > 0 ? Math.floor(realStock / dailyCount) : 999;
    const alertDays = r.stockAlertDays ?? 7;
    const isLow = daysRemaining <= alertDays;
    const estimatedRunOutDate = new Date();
    estimatedRunOutDate.setDate(estimatedRunOutDate.getDate() + daysRemaining);
    results.push({
      reminderId: r.id, medicationName: r.medicationName, dosage: r.dosage,
      stockQuantity: realStock, dailyDosageCount: dailyCount, daysRemaining,
      estimatedRunOutDate: estimatedRunOutDate.toISOString().slice(0, 10),
      alertDays, isLow, enabled: r.enabled,
      restockDate: latestRestock?.restockDate ?? null, hasRestockRecords: latestRestock !== null,
      defaultRestockQuantity: r.defaultRestockQuantity ?? null,
    });
  }
  return results;
}

export async function deductMedicationStock(userId: number, medicationName: string) {
  // No-op: stock is now computed in real-time
}

export async function getLowStockAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const stockStatuses = await getMedicationStockStatus(userId);
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));
  const reminderMap = new Map(reminders.map(r => [r.id, r]));
  return stockStatuses.filter((s) => {
    const reminder = reminderMap.get(s.reminderId);
    if (!reminder) return false;
    if (reminder.lastStockAlertDate === todayStr) return false;
    return s.isLow;
  }).map((s) => ({
    reminderId: s.reminderId, medicationName: s.medicationName,
    stockQuantity: s.stockQuantity, dailyDosageCount: s.dailyDosageCount, daysRemaining: s.daysRemaining,
  }));
}

export async function markStockAlertSent(id: number) {
  const db = await getDb();
  if (!db) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  await db.update(medicationReminders).set({ lastStockAlertDate: todayStr }).where(eq(medicationReminders.id, id));
}

export async function addMedicationRestock(
  userId: number, reminderId: number, restockQuantity: number, restockDate: string
): Promise<{ success: boolean }> {
  // Do NOT overwrite stockQuantity — stock is now computed in real-time from restocks + usage
  const db = await getDb();
  if (!db) return { success: false };
  const reminder = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.id, reminderId), eq(medicationReminders.userId, userId))).limit(1);
  if (reminder.length === 0) throw new Error("Reminder not found");
  await db.insert(medicationRestocks).values({ userId, reminderId, restockQuantity, restockDate });
  return { success: true };
}

export async function getRestockHistory(userId: number, reminderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicationRestocks)
    .where(and(eq(medicationRestocks.userId, userId), eq(medicationRestocks.reminderId, reminderId)))
    .orderBy(desc(medicationRestocks.createdAt));
}

export async function deleteMedicationRestock(userId: number, restockId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  const record = await db.select().from(medicationRestocks)
    .where(and(eq(medicationRestocks.id, restockId), eq(medicationRestocks.userId, userId))).limit(1);
  if (record.length === 0) throw new Error("Restock record not found");
  await db.delete(medicationRestocks)
    .where(and(eq(medicationRestocks.id, restockId), eq(medicationRestocks.userId, userId)));
  return { success: true };
}

export async function batchRestockMedications(
  userId: number, restockQuantity: number, restockDate: string
): Promise<{ restocked: number; names: string[] }> {
  const stockStatuses = await getMedicationStockStatus(userId);
  const lowStockItems = stockStatuses.filter(s => s.isLow);
  const names: string[] = [];
  for (const item of lowStockItems) {
    await addMedicationRestock(userId, item.reminderId, restockQuantity, restockDate);
    names.push(item.medicationName);
  }
  return { restocked: lowStockItems.length, names };
}

export async function getStockChangeLog(
  userId: number, reminderId: number
): Promise<Array<{ type: 'restock' | 'usage'; date: string; quantity: number; runningTotal?: number; note?: string; restockId?: number }>> {
  const db = await getDb();
  if (!db) return [];
  const [reminder] = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.id, reminderId), eq(medicationReminders.userId, userId))).limit(1);
  if (!reminder) return [];

  const restocks = await db.select().from(medicationRestocks)
    .where(and(eq(medicationRestocks.userId, userId), eq(medicationRestocks.reminderId, reminderId)))
    .orderBy(medicationRestocks.restockDate);

  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries).where(eq(symptomEntries.userId, userId)).orderBy(symptomEntries.date);

  const events: Array<{ type: 'restock' | 'usage'; date: string; quantity: number; note?: string; restockId?: number; sortKey: string }> = [];

  for (const r of restocks) {
    events.push({ type: 'restock', date: r.restockDate, quantity: r.restockQuantity, note: `补货 +${r.restockQuantity}`, restockId: r.id, sortKey: `${r.restockDate}-0` });
  }

  const medName = reminder.medicationName.toLowerCase();
  for (const entry of entries) {
    if (!entry.medications || !Array.isArray(entry.medications)) continue;
    const usageCount = (entry.medications as any[]).filter(
      (m: any) => m.reminderId === reminderId || (m.name && m.name.toLowerCase() === medName)
    ).length;
    if (usageCount > 0) {
      events.push({ type: 'usage', date: entry.date, quantity: usageCount, note: `服药 -${usageCount}`, sortKey: `${entry.date}-1` });
    }
  }

  events.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let runningTotal = reminder.stockQuantity ?? 0;
  const eventsWithTotal = events.map((e) => {
    if (e.type === 'restock') runningTotal += e.quantity;
    else runningTotal = Math.max(0, runningTotal - e.quantity);
    return { type: e.type, date: e.date, quantity: e.quantity, runningTotal, note: e.note, restockId: e.restockId };
  });

  return eventsWithTotal.reverse();
}

// ─── Monthly Consumption ──────────────────────────────────────────

export async function getMonthlyMedicationConsumption(
  userId: number, months: number = 6
): Promise<Array<{ month: string; medications: Array<{ name: string; reminderId: number; count: number }>; totalCount: number }>> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const todayStr = getDateStrInTimezone(DEFAULT_TIMEZONE, now);
  const todayDate = new Date(todayStr + "T00:00:00");
  const startDateObj = new Date(todayDate);
  startDateObj.setMonth(startDateObj.getMonth() - months + 1);
  startDateObj.setDate(1);
  const startDateStr = getDateStrInTimezone(DEFAULT_TIMEZONE, startDateObj);

  const reminders = await db.select({ id: medicationReminders.id, name: medicationReminders.medicationName })
    .from(medicationReminders).where(eq(medicationReminders.userId, userId));
  if (reminders.length === 0) return [];

  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, startDateStr)))
    .orderBy(symptomEntries.date);

  const monthMap = new Map<string, Map<string, { reminderId: number; count: number }>>();
  for (let i = 0; i < months; i++) {
    // Use day 1 to avoid month overflow (e.g., Mar 31 -> setMonth(-1) = Mar 3 instead of Feb)
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - (months - 1 - i), 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(monthKey, new Map());
  }

  for (const entry of entries) {
    if (!entry.medications || !Array.isArray(entry.medications)) continue;
    const monthKey = entry.date.slice(0, 7);
    if (!monthMap.has(monthKey)) continue;
    const medCounts = monthMap.get(monthKey)!;
    for (const m of entry.medications as { name: string; reminderId?: number }[]) {
      const matched = reminders.find((r) => r.id === m.reminderId || r.name.toLowerCase() === (m.name || "").toLowerCase());
      if (!matched) continue;
      const key = matched.name;
      if (!medCounts.has(key)) medCounts.set(key, { reminderId: matched.id, count: 0 });
      medCounts.get(key)!.count++;
    }
  }

  const result: Array<{ month: string; medications: Array<{ name: string; reminderId: number; count: number }>; totalCount: number }> = [];
  for (const month of Array.from(monthMap.keys())) {
    const medCounts = monthMap.get(month)!;
    const medications: Array<{ name: string; reminderId: number; count: number }> = [];
    for (const name of Array.from(medCounts.keys())) {
      const data = medCounts.get(name)!;
      medications.push({ name, reminderId: data.reminderId, count: data.count });
    }
    let totalCount = 0;
    for (const m of medications) totalCount += m.count;
    result.push({ month, medications, totalCount });
  }
  return result;
}

// ─── Today's Medications ──────────────────────────────────────────

export async function getTodayMedications(userId: number, dateStr: string) {
  const db = await getDb();
  if (!db) return [];

  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)))
    .orderBy(medicationReminders.reminderHour, medicationReminders.reminderMinute);

  const date = new Date(dateStr + "T00:00:00");
  const entry = await getEntryByUserAndDate(userId, dateStr);
  const takenMeds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] =
    entry && Array.isArray(entry.medications) ? entry.medications : [];

  const result: Array<{
    name: string; dosage: string; reminderId: number; reminderHour: number; reminderMinute: number;
    groupId: number | null; taken: boolean; timeIndex: number; totalTimes: number;
    intervalHours: number | null; lastTakenAt: string | null; note: string | null; stockQuantity: number | null;
  }> = [];

  const stockCache = new Map<number, number | null>();
  for (const r of reminders) {
    if (!stockCache.has(r.id)) stockCache.set(r.id, await computeRealTimeStock(userId, r));
  }

  for (const r of reminders) {
    if (!isReminderScheduledOnDate(r, dateStr)) continue;
    const allTimes = getAllReminderTimesForDate(r, dateStr);
    for (let ti = 0; ti < allTimes.length; ti++) {
      const t = allTimes[ti];
      const matchedMed = takenMeds.find(
        (m) => (m.reminderId === r.id || m.name.toLowerCase() === r.medicationName.toLowerCase()) &&
          (allTimes.length === 1 || m.timeIndex === ti)
      );
      result.push({
        name: r.medicationName, dosage: r.dosage, reminderId: r.id,
        reminderHour: t.hour, reminderMinute: t.minute, groupId: r.groupId,
        taken: !!matchedMed, timeIndex: ti, totalTimes: allTimes.length,
        intervalHours: r.intervalHours, lastTakenAt: r.lastTakenAt,
        note: (matchedMed as any)?.note || null, stockQuantity: stockCache.get(r.id) ?? null,
      });
    }
  }

  result.sort((a, b) => a.reminderHour * 60 + a.reminderMinute - (b.reminderHour * 60 + b.reminderMinute));
  return result;
}

// ─── Confirm / Unconfirm Medication Taken ──────────────────────────────

export async function confirmMedicationTaken(
  userId: number, reminderId: number, timeIndex?: number, note?: string, date?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reminder = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.id, reminderId), eq(medicationReminders.userId, userId))).limit(1);
  if (reminder.length === 0) throw new Error("Reminder not found");

  const med = reminder[0];
  const todayStr = date || getDateStrInTimezone(DEFAULT_TIMEZONE);
  const allTimes = getAllReminderTimesForDate(med, todayStr);
  const effectiveTimeIndex = timeIndex ?? 0;
  const existing = await getEntryByUserAndDate(userId, todayStr);

  const newMed: { name: string; dosage: string; reminderId: number; timeIndex?: number; note?: string } = {
    name: med.medicationName, dosage: med.dosage, reminderId: med.id,
    ...(allTimes.length > 1 ? { timeIndex: effectiveTimeIndex } : {}),
    ...(note ? { note } : {}),
  };

  if (existing) {
    const currentMeds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] =
      Array.isArray(existing.medications) ? existing.medications : [];
    const alreadyRecorded = currentMeds.some(
      (m) => (m.reminderId === med.id || m.name.toLowerCase() === newMed.name.toLowerCase()) &&
        (allTimes.length === 1 || m.timeIndex === effectiveTimeIndex)
    );
    if (!alreadyRecorded) {
      const updatedMeds = [...currentMeds, newMed];
      await db.update(symptomEntries).set({ medications: updatedMeds }).where(eq(symptomEntries.id, existing.id));
    }
  } else {
    await db.insert(symptomEntries).values({
      userId, date: todayStr, dizziness: 0, headache: 0, sleepQuality: 5, anxiety: 0,
      fatigue: 0, photosensitivity: 0, motionSickness: 0, palpitations: 0, mood: 5,
      medications: [newMed], triggers: [], severeHeadache: 0, painkillerTaken: 0, notes: null,
    });
  }

  await deductMedicationStock(userId, med.medicationName);
  const nowISO = new Date().toISOString();
  await db.update(medicationReminders).set({ lastTakenAt: nowISO }).where(eq(medicationReminders.id, reminderId));

  return { success: true, medicationName: med.medicationName, dosage: med.dosage, date: todayStr, timeIndex: effectiveTimeIndex };
}

export async function unconfirmMedicationTaken(
  userId: number, reminderId: number, timeIndex?: number, date?: string
) {
  // Unconfirm: stock is computed in real-time, so we only remove the entry
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reminder = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.id, reminderId), eq(medicationReminders.userId, userId))).limit(1);
  if (reminder.length === 0) throw new Error("Reminder not found");

  const med = reminder[0];
  const todayStr = date || getDateStrInTimezone(DEFAULT_TIMEZONE);
  const allTimes = getAllReminderTimesForDate(med, todayStr);
  const effectiveTimeIndex = timeIndex ?? 0;
  const existing = await getEntryByUserAndDate(userId, todayStr);
  if (!existing) return { success: true, medicationName: med.medicationName };

  const currentMeds: { name: string; dosage: string; reminderId?: number; timeIndex?: number }[] =
    Array.isArray(existing.medications) ? existing.medications : [];
  const updatedMeds = currentMeds.filter((m) => {
    const isMatch = m.reminderId === med.id || m.name.toLowerCase() === med.medicationName.toLowerCase();
    if (!isMatch) return true;
    if (allTimes.length === 1) return false;
    return m.timeIndex !== effectiveTimeIndex;
  });

  if (updatedMeds.length < currentMeds.length) {
    await db.update(symptomEntries).set({ medications: updatedMeds }).where(eq(symptomEntries.id, existing.id));
  }

  return { success: true, medicationName: med.medicationName };
}

// ─── Timeline, Calendar, Expiration ──────────────────────────────

export async function getMedicationTimeline(userId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return { medications: [], days: [] };
  const reminders = await db.select().from(medicationReminders).where(eq(medicationReminders.userId, userId));
  if (reminders.length === 0) return { medications: [], days: [] };

  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, startDate), lte(symptomEntries.date, endDate)))
    .orderBy(symptomEntries.date);

  const entryMap = buildEntryMedMap(entries);
  const medicationNames = reminders.map((r) => r.medicationName);
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  const days: Array<{ date: string; medications: Array<{ name: string; status: "taken" | "missed" | "not-scheduled" }> }> = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const recordedMeds = entryMap.get(dateStr);
    const dayMeds = reminders.map((reminder) => {
      if (!isReminderScheduledOnDate(reminder, dateStr)) return { name: reminder.medicationName, status: "not-scheduled" as const };
      const taken = wasMedTaken(recordedMeds, reminder.id, reminder.medicationName);
      return { name: reminder.medicationName, status: taken ? ("taken" as const) : ("missed" as const) };
    });
    days.push({ date: dateStr, medications: dayMeds });
  }

  return { medications: medicationNames, days };
}

export async function getMedicationCheckInCalendar(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return { days: [], streak: 0, monthlyRate: 0, totalScheduled: 0, totalCompleted: 0 };

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));
  if (reminders.length === 0) return { days: [], streak: 0, monthlyRate: 0, totalScheduled: 0, totalCompleted: 0 };

  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications, painkillerTaken: symptomEntries.painkillerTaken })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, startDate), lte(symptomEntries.date, endDate)));

  const painkillerMap = new Map<string, boolean>();
  for (const entry of entries) painkillerMap.set(entry.date, entry.painkillerTaken === 1);
  const entryMap = buildEntryMedMap(entries);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  type DayStatus = { date: string; status: "all-taken" | "partial" | "missed" | "no-schedule" | "future"; scheduledCount: number; takenCount: number; painkillerTaken: boolean };
  const days: DayStatus[] = [];
  let totalScheduled = 0, totalCompleted = 0;

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateStr > todayStr) { days.push({ date: dateStr, status: "future", scheduledCount: 0, takenCount: 0, painkillerTaken: false }); continue; }

    const scheduledReminders: { id: number; name: string }[] = [];
    let scheduledSlotCount = 0;
    for (const reminder of reminders) {
      if (!isReminderScheduledOnDate(reminder, dateStr)) continue;
      scheduledReminders.push({ id: reminder.id, name: reminder.medicationName });
      // Count actual time slots for this date (date-aware)
      const timesForDate = getAllReminderTimesForDate(reminder, dateStr);
      scheduledSlotCount += timesForDate.length;
    }

    if (scheduledReminders.length === 0) { days.push({ date: dateStr, status: "no-schedule", scheduledCount: 0, takenCount: 0, painkillerTaken: painkillerMap.get(dateStr) ?? false }); continue; }

    const recordedMeds = entryMap.get(dateStr);
    let takenCount = 0;
    for (const reminder of reminders) {
      if (!isReminderScheduledOnDate(reminder, dateStr)) continue;
      const timesForDate = getAllReminderTimesForDate(reminder, dateStr);
      if (timesForDate.length === 1) {
        if (wasMedTaken(recordedMeds, reminder.id, reminder.medicationName)) takenCount++;
      } else {
        for (let ti = 0; ti < timesForDate.length; ti++) {
          if (wasMedTaken(recordedMeds, reminder.id, reminder.medicationName, ti)) takenCount++;
        }
      }
    }

    totalScheduled += scheduledSlotCount;
    totalCompleted += takenCount;

    let status: "all-taken" | "partial" | "missed";
    if (takenCount >= scheduledSlotCount) status = "all-taken";
    else if (takenCount > 0) status = "partial";
    else status = "missed";

    days.push({ date: dateStr, status, scheduledCount: scheduledSlotCount, takenCount, painkillerTaken: painkillerMap.get(dateStr) ?? false });
  }

  let streak = 0;
  const todayIndex = days.findIndex((d) => d.date === todayStr);
  if (todayIndex >= 0) {
    for (let i = todayIndex; i >= 0; i--) {
      const day = days[i];
      if (day.status === "all-taken") streak++;
      else if (day.status === "no-schedule") continue;
      else break;
    }
  }

  const monthlyRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
  return { days, streak, monthlyRate, totalScheduled, totalCompleted };
}

export async function getExpiringMedications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return reminders.filter((r) => r.expirationDate).map((r) => {
    const expDate = new Date(r.expirationDate! + "T00:00:00");
    const diffMs = expDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const alertDays = r.expirationAlertDays ?? 30;
    return { ...r, daysUntilExpiry, isExpired: daysUntilExpiry < 0, isExpiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry <= alertDays };
  }).filter((r) => r.isExpired || r.isExpiringSoon);
}

export async function checkExpiringMedications() {
  const db = await getDb();
  if (!db) return;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const allReminders = await db.select().from(medicationReminders).where(eq(medicationReminders.enabled, 1));

  for (const reminder of allReminders) {
    if (!reminder.expirationDate) continue;
    if (reminder.lastExpirationAlertDate === todayStr) continue;
    const expDate = new Date(reminder.expirationDate + "T00:00:00");
    const diffMs = expDate.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const alertDays = reminder.expirationAlertDays ?? 30;

    if (daysUntilExpiry <= alertDays) {
      const subs = await getPushSubscriptionsByUserId(reminder.userId);
      if (subs.length > 0) {
        const isExpired = daysUntilExpiry < 0;
        const title = isExpired ? `⚠️ ${reminder.medicationName} 已过期` : `⏰ ${reminder.medicationName} 即将过期`;
        const body = isExpired
          ? `该药品已过期 ${Math.abs(daysUntilExpiry)} 天，请及时更换。`
          : `该药品将在 ${daysUntilExpiry} 天后过期（${reminder.expirationDate}），请注意补充。`;
        try {
          const webpush = await import("web-push");
          const vapidPublicKey = ENV.vapidPublicKey;
          const vapidPrivateKey = ENV.vapidPrivateKey;
          if (vapidPublicKey && vapidPrivateKey) {
            webpush.setVapidDetails("mailto:symptom-tracker@example.com", vapidPublicKey, vapidPrivateKey);
            const userSound = await getNotificationSoundForUser(reminder.userId);
            for (const sub of subs) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  JSON.stringify({ title, body, tag: `expiry-${reminder.id}`, sound: userSound })
                );
              } catch (err: any) { if (err.statusCode === 410) await removePushSubscription(reminder.userId, sub.endpoint); }
            }
          }
        } catch (err) { console.error("[Expiry] Push notification error:", err); }
      }
      await db.update(medicationReminders).set({ lastExpirationAlertDate: todayStr }).where(eq(medicationReminders.id, reminder.id));
    }
  }
}

export async function getMedicationCheckInDayDetail(userId: number, date: string) {
  const db = await getDb();
  if (!db) return { scheduled: [], taken: [], missed: [] };
  const dayDate = new Date(date + "T00:00:00");
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));

  const scheduled: { name: string; dosage: string; id: number }[] = [];
  for (const r of reminders) { if (isReminderScheduledOnDate(r, date)) scheduled.push({ name: r.medicationName, dosage: r.dosage, id: r.id }); }

  if (scheduled.length === 0) {
    const noSchedEntries = await db.select({ headacheAttack: symptomEntries.severeHeadache, painkillerTaken: symptomEntries.painkillerTaken })
      .from(symptomEntries).where(and(eq(symptomEntries.userId, userId), eq(symptomEntries.date, date))).limit(1);
    const ha = noSchedEntries.length > 0 ? (noSchedEntries[0].headacheAttack ?? 0) : 0;
    const pt = noSchedEntries.length > 0 ? (noSchedEntries[0].painkillerTaken === 1) : false;
    return { scheduled: [], taken: [], missed: [], headacheAttack: ha, painkillerTaken: pt };
  }

  const entries = await db.select({ medications: symptomEntries.medications, headacheAttack: symptomEntries.severeHeadache, painkillerTaken: symptomEntries.painkillerTaken })
    .from(symptomEntries).where(and(eq(symptomEntries.userId, userId), eq(symptomEntries.date, date))).limit(1);

  const recordedNames = new Set<string>();
  const recordedReminderIds = new Set<number>();
  const notesByReminderId = new Map<number, string>();
  const notesByName = new Map<string, string>();
  if (entries.length > 0 && Array.isArray(entries[0].medications)) {
    for (const m of entries[0].medications as { name: string; dosage: string; reminderId?: number; note?: string }[]) {
      if (m.name && m.name.trim()) { recordedNames.add(m.name.trim().toLowerCase()); if (m.note) notesByName.set(m.name.trim().toLowerCase(), m.note); }
      if (m.reminderId) { recordedReminderIds.add(m.reminderId); if (m.note) notesByReminderId.set(m.reminderId, m.note); }
    }
  }

  const matchInfo = { names: recordedNames, reminderIds: recordedReminderIds, reminderTimeKeys: new Set<string>() };
  const taken: { name: string; dosage: string; id: number; note?: string }[] = [];
  const missed: { name: string; dosage: string; id: number }[] = [];

  for (const med of scheduled) {
    if (wasMedTaken(matchInfo, med.id, med.name)) {
      const note = notesByReminderId.get(med.id) || notesByName.get(med.name.trim().toLowerCase());
      taken.push({ ...med, ...(note ? { note } : {}) });
    } else missed.push(med);
  }

  const headacheAttack = entries.length > 0 ? (entries[0].headacheAttack ?? 0) : 0;
  const painkillerTaken = entries.length > 0 ? (entries[0].painkillerTaken === 1) : false;
  return { scheduled, taken, missed, headacheAttack, painkillerTaken };
}

export async function batchUpdateMedicationReminders(
  userId: number, ids: number[], data: Partial<{ enabled: number; reminderHour: number; reminderMinute: number }>
) {
  const db = await getDb();
  if (!db) return;
  if (ids.length === 0) return;
  await db.update(medicationReminders).set(data)
    .where(and(eq(medicationReminders.userId, userId), inArray(medicationReminders.id, ids)));
}

// ─── Medication Groups ──────────────────────────────────────────────────

export async function getMedicationGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicationGroups).where(eq(medicationGroups.userId, userId))
    .orderBy(medicationGroups.sortOrder, medicationGroups.createdAt);
}

export async function createMedicationGroup(userId: number, data: { name: string; icon?: string; color?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ maxSort: sql<number>`COALESCE(MAX(${medicationGroups.sortOrder}), 0)` })
    .from(medicationGroups).where(eq(medicationGroups.userId, userId));
  const nextSort = (existing[0]?.maxSort ?? 0) + 1;
  const result = await db.insert(medicationGroups).values({
    userId, name: data.name, icon: data.icon ?? "Pill", color: data.color ?? "sage", sortOrder: nextSort,
  });
  return { id: result[0].insertId, name: data.name };
}

export async function updateMedicationGroup(
  userId: number, groupId: number, data: Partial<{ name: string; icon: string; color: string; sortOrder: number }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicationGroups).set(data)
    .where(and(eq(medicationGroups.id, groupId), eq(medicationGroups.userId, userId)));
}

export async function deleteMedicationGroup(userId: number, groupId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicationReminders).set({ groupId: null })
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.groupId, groupId)));
  await db.delete(medicationGroups)
    .where(and(eq(medicationGroups.id, groupId), eq(medicationGroups.userId, userId)));
}

export async function assignMedicationToGroup(userId: number, reminderId: number, groupId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(medicationReminders).set({ groupId })
    .where(and(eq(medicationReminders.id, reminderId), eq(medicationReminders.userId, userId)));
}

export async function batchAssignMedicationsToGroup(userId: number, reminderIds: number[], groupId: number | null) {
  const db = await getDb();
  if (!db) return;
  if (reminderIds.length === 0) return;
  await db.update(medicationReminders).set({ groupId })
    .where(and(eq(medicationReminders.userId, userId), inArray(medicationReminders.id, reminderIds)));
}

export async function getMedicationRemindersGrouped(userId: number) {
  const db = await getDb();
  if (!db) return { groups: [], ungrouped: [] };
  const [groups, reminders] = await Promise.all([
    db.select().from(medicationGroups).where(eq(medicationGroups.userId, userId))
      .orderBy(medicationGroups.sortOrder, medicationGroups.createdAt),
    db.select().from(medicationReminders).where(eq(medicationReminders.userId, userId))
      .orderBy(medicationReminders.reminderHour, medicationReminders.reminderMinute),
  ]);

  const remindersWithStock: (typeof reminders[number] & { stockQuantity: number | null })[] = [];
  for (const r of reminders) {
    const realStock = await computeRealTimeStock(userId, r);
    remindersWithStock.push({ ...r, stockQuantity: realStock });
  }

  const grouped = groups.map((g) => ({ ...g, medications: remindersWithStock.filter((r) => r.groupId === g.id) }));
  const ungrouped = remindersWithStock.filter((r) => !r.groupId);
  return { groups: grouped, ungrouped };
}

export async function confirmGroupMedicationsTaken(userId: number, groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.groupId, groupId), eq(medicationReminders.enabled, 1)));
  if (reminders.length === 0) return { confirmed: 0, skipped: 0 };

  const todayStr = getDateStrInTimezone(DEFAULT_TIMEZONE);
  const scheduledReminders = reminders.filter((r) => isReminderScheduledOnDate(r, todayStr));
  if (scheduledReminders.length === 0) return { confirmed: 0, skipped: 0 };

  const existing = await getEntryByUserAndDate(userId, todayStr);
  const currentMeds: { name: string; dosage: string; reminderId?: number }[] = existing
    ? (Array.isArray(existing.medications) ? existing.medications as any : []) : [];

  let confirmed = 0, skipped = 0;
  for (const med of scheduledReminders) {
    const alreadyRecorded = currentMeds.some(
      (m) => m.reminderId === med.id || m.name.toLowerCase() === med.medicationName.toLowerCase()
    );
    if (alreadyRecorded) { skipped++; continue; }
    currentMeds.push({ name: med.medicationName, dosage: med.dosage, reminderId: med.id });
    confirmed++;
    await deductMedicationStock(userId, med.medicationName);
  }

  if (confirmed > 0) {
    if (existing) {
      await db.update(symptomEntries).set({ medications: currentMeds }).where(eq(symptomEntries.id, existing.id));
    } else {
      await db.insert(symptomEntries).values({
        userId, date: todayStr, dizziness: 0, headache: 0, sleepQuality: 5, anxiety: 0,
        fatigue: 0, photosensitivity: 0, motionSickness: 0, palpitations: 0, mood: 5,
        medications: currentMeds, triggers: [], severeHeadache: 0, painkillerTaken: 0, notes: null,
      });
    }
  }
  return { confirmed, skipped };
}

// ─── Interval-based Reminders ──────────────────────────────────────

export async function getIntervalMedicationStatus(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));
  return reminders.filter((r) => r.intervalHours !== null && r.intervalHours > 0).map((r) => {
    const intervalInfo = getNextIntervalDoseTime(r.intervalHours, r.lastTakenAt);
    return {
      reminderId: r.id, medicationName: r.medicationName, dosage: r.dosage,
      intervalHours: r.intervalHours!, lastTakenAt: r.lastTakenAt,
      nextDoseAt: intervalInfo?.nextDoseAt.toISOString() ?? null,
      minutesUntil: intervalInfo?.minutesUntil ?? 0,
      isOverdue: (intervalInfo?.minutesUntil ?? 0) <= 0, groupId: r.groupId,
    };
  });
}

// ─── Drug Interactions ──────────────────────────────────────────

export async function getDrugInteractions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drugInteractions).where(eq(drugInteractions.userId, userId)).orderBy(drugInteractions.severity);
}

export async function saveDrugInteractions(
  userId: number,
  interactions: Array<{ drugA: string; drugB: string; severity: "mild" | "moderate" | "severe"; description: string; recommendation?: string; source?: string }>
) {
  const db = await getDb();
  if (!db) return;
  await db.delete(drugInteractions).where(eq(drugInteractions.userId, userId));
  if (interactions.length > 0) {
    await db.insert(drugInteractions).values(
      interactions.map((i) => ({
        userId, drugA: i.drugA, drugB: i.drugB, severity: i.severity,
        description: i.description, recommendation: i.recommendation ?? null, source: i.source ?? "ai",
      }))
    );
  }
}

export async function checkDrugInteractionsForMed(userId: number, medicationName: string) {
  const db = await getDb();
  if (!db) return [];
  const allInteractions = await getDrugInteractions(userId);
  const normalizedName = medicationName.trim().toLowerCase();
  return allInteractions.filter(
    (i) => i.drugA.trim().toLowerCase() === normalizedName || i.drugB.trim().toLowerCase() === normalizedName
  );
}

// ─── Medication Completion by Dates ──────────────────────────────

export async function getMedCompletionByDates(
  userId: number, dates: string[]
): Promise<Record<string, "all-taken" | "partial" | "missed" | "no-schedule">> {
  const db = await getDb();
  if (!db || dates.length === 0) return {};
  const reminders = await db.select().from(medicationReminders)
    .where(and(eq(medicationReminders.userId, userId), eq(medicationReminders.enabled, 1)));
  if (reminders.length === 0) {
    const result: Record<string, "no-schedule"> = {};
    dates.forEach((d) => (result[d] = "no-schedule"));
    return result;
  }

  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  const entries = await db.select({ date: symptomEntries.date, medications: symptomEntries.medications })
    .from(symptomEntries)
    .where(and(eq(symptomEntries.userId, userId), gte(symptomEntries.date, minDate), lte(symptomEntries.date, maxDate)));

  const entryMap = buildEntryMedMap(entries);
  const dateSet = new Set(dates);
  const result: Record<string, "all-taken" | "partial" | "missed" | "no-schedule"> = {};

  for (const dateStr of Array.from(dateSet)) {
    const scheduledReminders: { id: number; name: string }[] = [];
    let scheduledSlotCount = 0;
    for (const reminder of reminders) {
      if (!isReminderScheduledOnDate(reminder, dateStr)) continue;
      scheduledReminders.push({ id: reminder.id, name: reminder.medicationName });
      scheduledSlotCount += getAllReminderTimesForDate(reminder, dateStr).length;
    }
    if (scheduledReminders.length === 0) { result[dateStr] = "no-schedule"; continue; }
    const recordedMeds = entryMap.get(dateStr);
    let takenCount = 0;
    for (const reminder of reminders) {
      if (!isReminderScheduledOnDate(reminder, dateStr)) continue;
      const timesForDate = getAllReminderTimesForDate(reminder, dateStr);
      if (timesForDate.length === 1) {
        if (wasMedTaken(recordedMeds, reminder.id, reminder.medicationName)) takenCount++;
      } else {
        for (let ti = 0; ti < timesForDate.length; ti++) {
          if (wasMedTaken(recordedMeds, reminder.id, reminder.medicationName, ti)) takenCount++;
        }
      }
    }

    if (takenCount >= scheduledSlotCount) result[dateStr] = "all-taken";
    else if (takenCount > 0) result[dateStr] = "partial";
    else result[dateStr] = "missed";
  }
  return result;
}

