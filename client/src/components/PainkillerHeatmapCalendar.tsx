/**
 * PainkillerHeatmapCalendar — Monthly calendar heatmap showing painkiller usage
 * Color intensity indicates usage: no usage = light, used = dark orange/red
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Pill, ChevronLeft, ChevronRight, Flame } from "lucide-react";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function getMonthDays(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function PainkillerHeatmapCalendar() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Get all entries
  const { data: entries } = trpc.entries.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Build painkiller map for the viewed month
  const { calendarCells, monthPainkillerDays, monthTotalDays } = useMemo(() => {
    const daysInMonth = getMonthDays(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

    // Build a set of dates with painkiller taken
    const painkillerDates = new Set<string>();
    if (entries) {
      for (const e of entries) {
        if ((e as any).painkillerTaken) {
          painkillerDates.add(e.date);
        }
      }
    }

    const cells: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      painkillerTaken: boolean;
      isToday: boolean;
      isFuture: boolean;
    }[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push({
        day: 0,
        dateStr: "",
        isCurrentMonth: false,
        painkillerTaken: false,
        isToday: false,
        isFuture: false,
      });
    }

    let painkillerCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const taken = painkillerDates.has(dateStr);
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      if (taken) painkillerCount++;

      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        painkillerTaken: taken,
        isToday,
        isFuture,
      });
    }

    return {
      calendarCells: cells,
      monthPainkillerDays: painkillerCount,
      monthTotalDays: daysInMonth,
    };
  }, [entries, viewYear, viewMonth, todayStr]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();
    if (isCurrentMonth) return; // Don't go to future months
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="bg-card rounded-2xl p-4 shadow-sm border border-border/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100 dark:bg-orange-950/30">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">止疼药热力图</h3>
            <p className="text-[10px] text-muted-foreground">颜色越深表示用药频率越高</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-orange-50 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-800/30 text-orange-600 dark:text-orange-400">
          <Pill className="w-3 h-3" />
          {monthPainkillerDays}天
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPrevMonth}
          className="p-1 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {viewYear}年{viewMonth + 1}月
        </span>
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] text-muted-foreground font-medium py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, i) => {
          if (!cell.isCurrentMonth) {
            return <div key={i} className="aspect-square" />;
          }

          return (
            <div
              key={i}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] relative transition-colors ${
                cell.isFuture
                  ? "bg-muted/30 text-muted-foreground/30"
                  : cell.painkillerTaken
                    ? "bg-orange-400 dark:bg-orange-600 text-white font-semibold shadow-sm"
                    : "bg-muted/50 text-muted-foreground"
              } ${cell.isToday ? "ring-2 ring-terracotta ring-offset-1 ring-offset-background" : ""}`}
            >
              <span>{cell.day}</span>
              {cell.painkillerTaken && (
                <Pill className="w-2.5 h-2.5 mt-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted/50" />
          <span className="text-[10px] text-muted-foreground">未服用</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-400 dark:bg-orange-600" />
          <span className="text-[10px] text-muted-foreground">已服用</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted/30" />
          <span className="text-[10px] text-muted-foreground">未来</span>
        </div>
      </div>
    </motion.div>
  );
}
