import { getLocalDateStr } from "@shared/timezone";

export const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];

export const OFFSET_OPTIONS = [
  { value: -60, label: "提前60分钟" },
  { value: -30, label: "提前30分钟" },
  { value: -15, label: "提前15分钟" },
  { value: 0, label: "准时" },
  { value: 15, label: "延后15分钟" },
  { value: 30, label: "延后30分钟" },
  { value: 60, label: "延后60分钟" },
];

export interface ReminderForm {
  medicationName: string;
  dosage: string;
  reminderHour: number;
  reminderMinute: number;
  reminderTimes: { hour: number; minute: number }[];
  repeatDays: number[];
  offsetMinutes: number;
  trackStock: boolean;
  stockQuantity: number | string;
  dailyDosageCount: number | string;
  stockAlertDays: number | string;
  instructionUrl: string;
  expirationDate: string;
  expirationAlertDays: number | string;
  groupId: number | null;
  intervalHours: number | null;
  startDate: string;
  endDate: string;
}

export const EMPTY_FORM: ReminderForm = {
  medicationName: "",
  dosage: "",
  reminderHour: 8,
  reminderMinute: 0,
  reminderTimes: [],
  repeatDays: [...ALL_DAYS],
  offsetMinutes: 0,
  trackStock: false,
  stockQuantity: 30,
  dailyDosageCount: 1,
  stockAlertDays: 7,
  instructionUrl: "",
  expirationDate: "",
  expirationAlertDays: 30,
  groupId: null,
  intervalHours: null,
  startDate: getLocalDateStr(),
  endDate: "",
};

export function formatRepeatDays(days: number[] | null): string {
  if (!days || days.length === 0 || days.length === 7) return "每天";
  const sorted = [...days].sort();
  if (sorted.length === 5 && WEEKDAYS.every((d) => sorted.includes(d)))
    return "工作日";
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6))
    return "周末";
  return sorted.map((d) => `周${DAY_LABELS[d]}`).join("、");
}

export function formatOffset(offset: number): string {
  if (offset === 0) return "";
  if (offset < 0) return `提前${Math.abs(offset)}分钟`;
  return `延后${offset}分钟`;
}

export function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
