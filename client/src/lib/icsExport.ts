/**
 * Generate iCalendar (.ics) file content for medication reminders.
 * iPhone will prompt to add to Calendar app when opening the file.
 * Supports RRULE for repeat days (daily or specific weekdays).
 */

const ICS_DAY_MAP: Record<number, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Format a date + hour/minute into iCalendar DTSTART format.
 * Uses local time with TZID for China timezone.
 */
function formatIcsDate(hour: number, minute: number): string {
  // Use tomorrow as start date to avoid past-time issues
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const y = tomorrow.getFullYear();
  const mo = pad(tomorrow.getMonth() + 1);
  const d = pad(tomorrow.getDate());
  return `${y}${mo}${d}T${pad(hour)}${pad(minute)}00`;
}

/**
 * Generate RRULE based on repeat days.
 * null/empty/all 7 days = FREQ=DAILY
 * specific days = FREQ=WEEKLY;BYDAY=MO,TU,...
 */
function generateRRule(repeatDays: number[] | null): string {
  if (!repeatDays || repeatDays.length === 0 || repeatDays.length === 7) {
    return "RRULE:FREQ=DAILY";
  }
  const days = repeatDays
    .sort()
    .map((d) => ICS_DAY_MAP[d])
    .filter(Boolean)
    .join(",");
  return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
}

/**
 * Generate a unique UID for the event.
 */
function generateUid(): string {
  return `med-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@symptom-tracker`;
}

/**
 * Escape special characters in iCalendar text fields.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

interface MedicationReminder {
  id: number;
  medicationName: string;
  dosage: string;
  reminderHour: number;
  reminderMinute: number;
  repeatDays: number[] | null;
  offsetMinutes?: number | null;
}

/**
 * Generate a single VEVENT block for one medication reminder.
 */
function generateVEvent(reminder: MedicationReminder): string {
  // Apply offset to get effective reminder time
  let effectiveHour = reminder.reminderHour;
  let effectiveMinute = reminder.reminderMinute;
  const offset = reminder.offsetMinutes ?? 0;
  if (offset !== 0) {
    let totalMinutes = effectiveHour * 60 + effectiveMinute + offset;
    if (totalMinutes < 0) totalMinutes = 0;
    if (totalMinutes > 23 * 60 + 59) totalMinutes = 23 * 60 + 59;
    effectiveHour = Math.floor(totalMinutes / 60);
    effectiveMinute = totalMinutes % 60;
  }

  const dtstart = formatIcsDate(effectiveHour, effectiveMinute);
  // Event duration: 5 minutes
  const endMinute = effectiveMinute + 5;
  const endHour = effectiveHour + Math.floor(endMinute / 60);
  const dtend = formatIcsDate(endHour % 24, endMinute % 60);
  const rrule = generateRRule(reminder.repeatDays);
  const uid = generateUid();
  const summary = escapeIcsText(`💊 ${reminder.medicationName}`);
  const description = escapeIcsText(
    `服用 ${reminder.medicationName} ${reminder.dosage}`
  );

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;TZID=Asia/Shanghai:${dtstart}`,
    `DTEND;TZID=Asia/Shanghai:${dtend}`,
    rrule,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    // Alarm: alert at event time
    "BEGIN:VALARM",
    "TRIGGER:PT0S",
    "ACTION:DISPLAY",
    `DESCRIPTION:${description}`,
    "END:VALARM",
    // Second alarm: 5 minutes before
    "BEGIN:VALARM",
    "TRIGGER:-PT5M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${description}`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

/**
 * Generate a complete .ics file for one or more medication reminders.
 */
export function generateIcsContent(reminders: MedicationReminder[]): string {
  const events = reminders.map(generateVEvent).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SymptomTracker//MedicationReminder//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:用药提醒",
    "X-WR-TIMEZONE:Asia/Shanghai",
    // Timezone definition
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Shanghai",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "END:STANDARD",
    "END:VTIMEZONE",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Download .ics file to user's device.
 * On iOS Safari / PWA, this triggers the "Add to Calendar" system dialog.
 */
export function downloadIcsFile(
  reminders: MedicationReminder[],
  filename?: string
): void {
  const content = generateIcsContent(reminders);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "medication-reminders.ics";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Export a single medication reminder as .ics file.
 */
export function exportSingleReminder(reminder: MedicationReminder): void {
  const safeName = reminder.medicationName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_");
  downloadIcsFile([reminder], `${safeName}-提醒.ics`);
}

/**
 * Export all medication reminders as a single .ics file.
 */
export function exportAllReminders(reminders: MedicationReminder[]): void {
  downloadIcsFile(reminders, "全部用药提醒.ics");
}

// ============================================================
// Stock / Refill Calendar Export
// ============================================================

interface StockItem {
  reminderId: number;
  medicationName: string;
  dosage: string;
  stockQuantity: number;
  dailyDosageCount: number;
  alertDays: number;
  daysRemaining: number;
  estimatedRunOutDate: string; // YYYY-MM-DD
  isLow: boolean;
}

/**
 * Format a specific date into iCalendar date format.
 */
function formatIcsFullDate(dateStr: string, hour: number, minute: number): string {
  const [y, mo, d] = dateStr.split("-");
  return `${y}${mo}${d}T${pad(hour)}${pad(minute)}00`;
}

/**
 * Generate a VEVENT for a stock refill reminder.
 * Creates a one-time event on the date when stock alert threshold is reached,
 * so the user gets reminded to refill before running out.
 */
function generateStockVEvent(item: StockItem): string {
  // Calculate the refill reminder date: estimatedRunOutDate - alertDays
  const runOutDate = new Date(item.estimatedRunOutDate + "T00:00:00+08:00");
  const refillDate = new Date(runOutDate.getTime() - item.alertDays * 24 * 60 * 60 * 1000);
  
  // If refill date is already past, use tomorrow
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const effectiveDate = refillDate > tomorrow ? refillDate : tomorrow;
  
  const dateStr = `${effectiveDate.getFullYear()}-${pad(effectiveDate.getMonth() + 1)}-${pad(effectiveDate.getDate())}`;
  
  // Set reminder at 9:00 AM
  const dtstart = formatIcsFullDate(dateStr, 9, 0);
  const dtend = formatIcsFullDate(dateStr, 9, 30);
  const uid = generateUid();
  
  const summary = escapeIcsText(`📦 备药提醒：${item.medicationName}`);
  const description = escapeIcsText(
    `${item.medicationName}（${item.dosage}）\n` +
    `当前库存：${item.stockQuantity} 剂\n` +
    `每日用量：${item.dailyDosageCount} 剂\n` +
    `预计 ${item.estimatedRunOutDate} 用完\n` +
    `请及时补充药品库存。`
  );

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;TZID=Asia/Shanghai:${dtstart}`,
    `DTEND;TZID=Asia/Shanghai:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    // Alarm: alert at event time
    "BEGIN:VALARM",
    "TRIGGER:PT0S",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`${item.medicationName} 库存不足，请及时备药`)}`,
    "END:VALARM",
    // Second alarm: 1 hour before
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`${item.medicationName} 库存不足，请及时备药`)}`,
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}

/**
 * Generate a complete .ics file for stock refill reminders.
 */
function generateStockIcsContent(items: StockItem[]): string {
  const events = items.map(generateStockVEvent).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SymptomTracker//StockReminder//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:备药提醒",
    "X-WR-TIMEZONE:Asia/Shanghai",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Shanghai",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "END:STANDARD",
    "END:VTIMEZONE",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Download stock refill .ics file.
 */
function downloadStockIcsFile(items: StockItem[], filename?: string): void {
  const content = generateStockIcsContent(items);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "备药提醒.ics";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Export a single stock refill reminder as .ics file.
 */
export function exportSingleStockReminder(item: StockItem): void {
  const safeName = item.medicationName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, "_");
  downloadStockIcsFile([item], `${safeName}-备药提醒.ics`);
}

/**
 * Export all stock refill reminders as a single .ics file.
 */
export function exportAllStockReminders(items: StockItem[]): void {
  downloadStockIcsFile(items, "全部备药提醒.ics");
}
