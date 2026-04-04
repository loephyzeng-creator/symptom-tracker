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
export const TIMEZONE_OPTIONS_BASE = [
  { value: "Asia/Shanghai", label: "中国标准时间 (UTC+8)" },
  { value: "Asia/Tokyo", label: "日本标准时间 (UTC+9)" },
  { value: "Asia/Seoul", label: "韩国标准时间 (UTC+9)" },
  { value: "Asia/Singapore", label: "新加坡时间 (UTC+8)" },
  { value: "Asia/Hong_Kong", label: "香港时间 (UTC+8)" },
  { value: "Asia/Taipei", label: "台北时间 (UTC+8)" },
  { value: "Asia/Kolkata", label: "印度标准时间 (UTC+5:30)" },
  { value: "Asia/Dubai", label: "海湾标准时间 (UTC+4)" },
  { value: "Asia/Bangkok", label: "泰国时间 (UTC+7)" },
  { value: "Asia/Jakarta", label: "印尼西部时间 (UTC+7)" },
  { value: "Asia/Manila", label: "菲律宾时间 (UTC+8)" },
  { value: "Asia/Kuala_Lumpur", label: "马来西亚时间 (UTC+8)" },
  { value: "Asia/Riyadh", label: "沙特时间 (UTC+3)" },
  { value: "Europe/London", label: "英国时间 (UTC+0/+1)" },
  { value: "Europe/Paris", label: "中欧时间 (UTC+1/+2)" },
  { value: "Europe/Berlin", label: "德国时间 (UTC+1/+2)" },
  { value: "Europe/Moscow", label: "莫斯科时间 (UTC+3)" },
  { value: "Europe/Istanbul", label: "土耳其时间 (UTC+3)" },
  { value: "Africa/Cairo", label: "埃及时间 (UTC+2)" },
  { value: "Africa/Johannesburg", label: "南非时间 (UTC+2)" },
  { value: "Africa/Lagos", label: "西非时间 (UTC+1)" },
  { value: "Africa/Nairobi", label: "东非时间 (UTC+3)" },
  { value: "Africa/Kampala", label: "乌干达时间 (UTC+3)" },
  { value: "America/New_York", label: "美国东部时间 (UTC-5/-4)" },
  { value: "America/Chicago", label: "美国中部时间 (UTC-6/-5)" },
  { value: "America/Denver", label: "美国山地时间 (UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "美国太平洋时间 (UTC-8/-7)" },
  { value: "America/Anchorage", label: "阿拉斯加时间 (UTC-9/-8)" },
  { value: "America/Mexico_City", label: "墨西哥时间 (UTC-6/-5)" },
  { value: "America/Toronto", label: "加拿大东部时间 (UTC-5/-4)" },
  { value: "America/Vancouver", label: "加拿大太平洋时间 (UTC-8/-7)" },
  { value: "Pacific/Honolulu", label: "夏威夷时间 (UTC-10)" },
  { value: "America/Sao_Paulo", label: "巴西利亚时间 (UTC-3)" },
  { value: "America/Argentina/Buenos_Aires", label: "阿根廷时间 (UTC-3)" },
  { value: "Australia/Sydney", label: "澳大利亚东部时间 (UTC+10/+11)" },
  { value: "Australia/Perth", label: "澳大利亚西部时间 (UTC+8)" },
  { value: "Pacific/Auckland", label: "新西兰时间 (UTC+12/+13)" },
];

/**
 * Get the UTC offset string for a given IANA timezone.
 * Returns something like "UTC+3" or "UTC-5:30".
 */
function getUtcOffsetLabel(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (offsetPart) {
      // e.g. "GMT+3" -> "UTC+3"
      return offsetPart.value.replace("GMT", "UTC");
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * Get the full timezone options list.
 * If the browser's timezone is not in the base list, it is dynamically added.
 */
export function getTimezoneOptions(browserTz?: string): { value: string; label: string }[] {
  const options = [...TIMEZONE_OPTIONS_BASE];
  const tz = browserTz || getBrowserTimezone();
  if (tz && !options.find((o) => o.value === tz)) {
    const offset = getUtcOffsetLabel(tz);
    const label = offset ? `${tz} (${offset})` : tz;
    // Insert at the beginning so it's easy to find
    options.unshift({ value: tz, label });
  }
  return options;
}

/** @deprecated Use getTimezoneOptions() instead for dynamic browser timezone support */
export const TIMEZONE_OPTIONS = TIMEZONE_OPTIONS_BASE;
