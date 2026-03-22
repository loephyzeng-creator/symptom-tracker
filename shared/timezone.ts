/**
 * Shared timezone utilities used by both frontend and backend.
 * All functions accept an IANA timezone string (e.g. "Asia/Shanghai", "America/New_York").
 */

/** Default timezone fallback */
export const DEFAULT_TIMEZONE = "Asia/Shanghai";

/**
 * Get the current date string (YYYY-MM-DD) in the given timezone.
 */
export function getDateStrInTimezone(tz: string, now?: Date): string {
  const d = now ?? new Date();
  try {
    // Use Intl.DateTimeFormat to get date parts in the target timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);

    const year = parts.find((p) => p.type === "year")!.value;
    const month = parts.find((p) => p.type === "month")!.value;
    const day = parts.find((p) => p.type === "day")!.value;
    return `${year}-${month}-${day}`;
  } catch {
    // Fallback: use UTC+8 if timezone is invalid
    const offset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + offset);
    return chinaTime.toISOString().slice(0, 10);
  }
}

/**
 * Get the current hour, minute, and day of week in the given timezone.
 */
export function getTimeInTimezone(tz: string, now?: Date): {
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
} {
  const d = now ?? new Date();
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);

    // Get day of week using a separate formatter
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    });
    const dayStr = dayFormatter.format(d);
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayOfWeek = dayMap[dayStr] ?? d.getDay();

    return { hour: hour === 24 ? 0 : hour, minute, dayOfWeek };
  } catch {
    // Fallback: UTC+8
    const offset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + offset);
    return {
      hour: chinaTime.getUTCHours(),
      minute: chinaTime.getUTCMinutes(),
      dayOfWeek: chinaTime.getUTCDay(),
    };
  }
}

/**
 * Get a full datetime string (YYYY-MM-DD HH:mm) in the given timezone.
 */
export function getDateTimeStrInTimezone(tz: string, now?: Date): string {
  const d = now ?? new Date();
  const dateStr = getDateStrInTimezone(tz, d);
  const { hour, minute } = getTimeInTimezone(tz, d);
  return `${dateStr} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Get the current local date string (YYYY-MM-DD) using the browser's local timezone.
 * This should only be used on the frontend as a fallback when user timezone is unknown.
 */
export function getLocalDateStr(now?: Date): string {
  const d = now ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Get the browser's IANA timezone string (e.g. "Asia/Shanghai").
 * Only works in browser environment.
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Common timezone options for the settings UI.
 */
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Shanghai", label: "中国标准时间 (UTC+8)" },
  { value: "Asia/Tokyo", label: "日本标准时间 (UTC+9)" },
  { value: "Asia/Seoul", label: "韩国标准时间 (UTC+9)" },
  { value: "Asia/Singapore", label: "新加坡时间 (UTC+8)" },
  { value: "Asia/Hong_Kong", label: "香港时间 (UTC+8)" },
  { value: "Asia/Taipei", label: "台北时间 (UTC+8)" },
  { value: "Asia/Kolkata", label: "印度标准时间 (UTC+5:30)" },
  { value: "Asia/Dubai", label: "海湾标准时间 (UTC+4)" },
  { value: "Europe/London", label: "英国时间 (UTC+0/+1)" },
  { value: "Europe/Paris", label: "中欧时间 (UTC+1/+2)" },
  { value: "Europe/Berlin", label: "德国时间 (UTC+1/+2)" },
  { value: "Europe/Moscow", label: "莫斯科时间 (UTC+3)" },
  { value: "America/New_York", label: "美国东部时间 (UTC-5/-4)" },
  { value: "America/Chicago", label: "美国中部时间 (UTC-6/-5)" },
  { value: "America/Denver", label: "美国山地时间 (UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "美国太平洋时间 (UTC-8/-7)" },
  { value: "America/Anchorage", label: "阿拉斯加时间 (UTC-9/-8)" },
  { value: "Pacific/Honolulu", label: "夏威夷时间 (UTC-10)" },
  { value: "America/Sao_Paulo", label: "巴西利亚时间 (UTC-3)" },
  { value: "Australia/Sydney", label: "澳大利亚东部时间 (UTC+10/+11)" },
  { value: "Pacific/Auckland", label: "新西兰时间 (UTC+12/+13)" },
];
