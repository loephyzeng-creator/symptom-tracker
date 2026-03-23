import { CalendarDays } from "lucide-react";
import { DAY_LABELS, ALL_DAYS, WEEKDAYS } from "./types";

export default function DaySelector({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  const isAllDays =
    selected.length === 7 && ALL_DAYS.every((d) => selected.includes(d));
  const isWeekdays =
    selected.length === 5 && WEEKDAYS.every((d) => selected.includes(d));

  const toggleDay = (day: number) => {
    if (selected.includes(day)) {
      const next = selected.filter((d) => d !== day);
      if (next.length === 0) return;
      onChange(next);
    } else {
      onChange([...selected, day].sort());
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">重复日</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onChange([...ALL_DAYS])}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isAllDays
              ? "bg-terracotta text-white border-terracotta"
              : "border-border text-muted-foreground hover:border-terracotta/50"
          }`}
        >
          每天
        </button>
        <button
          type="button"
          onClick={() => onChange([...WEEKDAYS])}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isWeekdays && !isAllDays
              ? "bg-terracotta text-white border-terracotta"
              : "border-border text-muted-foreground hover:border-terracotta/50"
          }`}
        >
          工作日
        </button>
      </div>
      <div className="flex gap-1">
        {ALL_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
              selected.includes(day)
                ? "bg-terracotta/90 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>
    </div>
  );
}
