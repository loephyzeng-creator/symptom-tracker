import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Check,
  X,
  Minus,
  CalendarCheck,
  Trophy,
  Pill,
  Loader2,
  MessageSquare,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const HEADACHE_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "无", color: "text-muted-foreground" },
  1: { label: "轻微", color: "text-amber-600 dark:text-amber-400" },
  2: { label: "明显", color: "text-orange-600 dark:text-orange-400" },
  3: { label: "严重", color: "text-red-600 dark:text-red-400" },
};

type DayStatus = "all-taken" | "partial" | "missed" | "no-schedule" | "future";

function getStatusColor(status: DayStatus) {
  switch (status) {
    case "all-taken":
      return "bg-emerald-500 text-white";
    case "partial":
      return "bg-amber-400 text-white";
    case "missed":
      return "bg-red-400/80 text-white";
    case "no-schedule":
      return "bg-muted/50 text-muted-foreground/50";
    case "future":
      return "bg-transparent text-muted-foreground/30";
    default:
      return "";
  }
}

function getStatusIcon(status: DayStatus, size = 12) {
  switch (status) {
    case "all-taken":
      return <Check className={`w-[${size}px] h-[${size}px]`} strokeWidth={3} />;
    case "partial":
      return <Minus className={`w-[${size}px] h-[${size}px]`} strokeWidth={3} />;
    case "missed":
      return <X className={`w-[${size}px] h-[${size}px]`} strokeWidth={3} />;
    default:
      return null;
  }
}

/* ─── DayDetailPanel: Shows per-medication detail when a day is clicked ─── */
function DayDetailPanel({
  date,
  status,
  scheduledCount,
  takenCount,
}: {
  date: string;
  status: DayStatus;
  scheduledCount: number;
  takenCount: number;
}) {
  const { data: detail, isLoading } = trpc.medReminders.dayDetail.useQuery(
    { date },
    { staleTime: 60_000 }
  );

  const statusLabel =
    status === "all-taken"
      ? "全部按时服药"
      : status === "partial"
        ? `部分服药 (${takenCount}/${scheduledCount})`
        : status === "no-schedule"
          ? "当日无用药安排"
          : "未服药";

  const statusDotColor =
    status === "all-taken"
      ? "bg-emerald-500"
      : status === "partial"
        ? "bg-amber-400"
        : status === "missed"
          ? "bg-red-400"
          : "bg-muted";

  const headacheLevel = detail?.headacheAttack ?? 0;
  const headacheInfo = HEADACHE_LABELS[headacheLevel] ?? HEADACHE_LABELS[0];
  const painkillerTaken = detail?.painkillerTaken ?? false;

  return (
    <div className="px-4 py-3 border-t border-border/50 bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-foreground">
          {date.replace(/-/g, "/")}
        </p>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusDotColor}`} />
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      {/* Headache & Painkiller correlation display */}
      {detail && (headacheLevel > 0 || painkillerTaken) && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {headacheLevel > 0 && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              headacheLevel === 3
                ? "bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/30"
                : headacheLevel === 2
                  ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-800/30"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30"
            }`}>
              <Brain className={`w-3 h-3 ${headacheInfo.color}`} />
              <span className={headacheInfo.color}>头痛: {headacheInfo.label}</span>
            </div>
          )}
          {painkillerTaken && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/30 text-rose-600 dark:text-rose-400">
              <Pill className="w-3 h-3" />
              已服止疼药
            </div>
          )}
          {headacheLevel > 0 && painkillerTaken && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <AlertTriangle className="w-3 h-3" />
              头痛+止疼药
            </div>
          )}
        </div>
      )}

      {status === "no-schedule" && !detail?.headacheAttack && !detail?.painkillerTaken ? (
        <p className="text-xs text-muted-foreground">当日无用药安排</p>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : detail ? (
        <div className="space-y-1.5">
          {detail.taken.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                <Check className="w-3 h-3" strokeWidth={3} />
                已服药 ({detail.taken.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.taken.map((med: any, i: number) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30 flex items-center gap-1"
                  >
                    <Pill className="w-3 h-3" />
                    {med.name}
                    <span className="text-emerald-500/60 text-[10px]">{med.dosage}</span>
                    {med.note && (
                      <span className="text-emerald-500/70 text-[10px] flex items-center gap-0.5 ml-0.5">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {med.note}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          {detail.missed.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-red-500 dark:text-red-400 mb-1 flex items-center gap-1">
                <X className="w-3 h-3" strokeWidth={3} />
                漏服 ({detail.missed.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.missed.map((med, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200/50 dark:border-red-800/30 flex items-center gap-1"
                  >
                    <Pill className="w-3 h-3" />
                    {med.name}
                    <span className="text-red-500/60 text-[10px]">{med.dosage}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function MedicationCheckInCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Long-press state
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.medReminders.checkInCalendar.useQuery(
    { year, month },
    { staleTime: 60_000 }
  );

  const togglePainkillerMutation = trpc.entries.togglePainkiller.useMutation({
    onSuccess: (result, variables) => {
      // Invalidate calendar and painkiller usage queries
      utils.medReminders.checkInCalendar.invalidate();
      utils.medReminders.dayDetail.invalidate();
      utils.entries.painkillerUsage.invalidate();
      if (result.painkillerTaken) {
        toast.success(`${variables.date} 已标记服用止疼药`);
      } else {
        toast.success(`${variables.date} 已取消止疼药标记`);
      }
    },
    onError: () => {
      toast.error("操作失败，请重试");
    },
  });

  // Long-press handlers
  const handlePointerDown = useCallback((date: string, status: DayStatus) => {
    if (status === "future") return;
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      togglePainkillerMutation.mutate({ date });
    }, 600); // 600ms long press
  }, [togglePainkillerMutation]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Build calendar grid
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const lastDate = new Date(year, month, 0).getDate();

    const grid: Array<{
      date: string;
      day: number;
      status: DayStatus;
      scheduledCount: number;
      takenCount: number;
      painkillerTaken: boolean;
    } | null> = [];

    // Fill leading empty cells
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }

    // Fill day cells
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayData = data?.days.find((dd) => dd.date === dateStr);
      grid.push({
        date: dateStr,
        day: d,
        status: dayData?.status ?? "future",
        scheduledCount: dayData?.scheduledCount ?? 0,
        takenCount: dayData?.takenCount ?? 0,
        painkillerTaken: dayData?.painkillerTaken ?? false,
      });
    }

    return grid;
  }, [year, month, data]);

  // Monthly painkiller count
  const monthlyPainkillerCount = useMemo(() => {
    return calendarGrid.filter((cell) => cell?.painkillerTaken).length;
  }, [calendarGrid]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    // Don't go beyond current month
    if (year === currentYear && month === currentMonth) return;
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedDay(null);
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const selectedDayData = selectedDay
    ? calendarGrid.find((d) => d?.date === selectedDay)
    : null;

  // Streak message
  const streakMessage = useMemo(() => {
    if (!data || data.streak === 0) return null;
    if (data.streak >= 30) return `🔥 连续打卡 ${data.streak} 天！太棒了！`;
    if (data.streak >= 14) return `🔥 连续打卡 ${data.streak} 天！坚持就是胜利！`;
    if (data.streak >= 7) return `🔥 连续打卡 ${data.streak} 天！一周达成！`;
    if (data.streak >= 3) return `🔥 连续打卡 ${data.streak} 天！继续加油！`;
    return `🔥 连续打卡 ${data.streak} 天`;
  }, [data]);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      {/* Header with stats */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-serif text-base font-semibold text-foreground">
              服药打卡
            </h3>
          </div>
        </div>

        {/* Stats row */}
        {data && !isLoading && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Streak */}
            {data.streak > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/30">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                  {data.streak}天
                </span>
              </div>
            )}
            {/* Monthly rate */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
              <Trophy className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                本月 {data.monthlyRate}%
              </span>
            </div>
            {/* Completed / Total */}
            <span className="text-xs text-muted-foreground">
              {data.totalCompleted}/{data.totalScheduled}
            </span>
            {/* Monthly painkiller count */}
            {monthlyPainkillerCount > 0 && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                monthlyPainkillerCount >= 10
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/30"
                  : monthlyPainkillerCount >= 7
                    ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-800/30"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200/50 dark:border-rose-800/30"
              }`}>
                <Pill className={`w-3.5 h-3.5 ${
                  monthlyPainkillerCount >= 10
                    ? "text-red-500"
                    : monthlyPainkillerCount >= 7
                      ? "text-orange-500"
                      : "text-rose-500"
                }`} />
                <span className={`text-xs font-semibold ${
                  monthlyPainkillerCount >= 10
                    ? "text-red-600 dark:text-red-400"
                    : monthlyPainkillerCount >= 7
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-rose-600 dark:text-rose-400"
                }`}>
                  止疼药 {monthlyPainkillerCount}天
                </span>
              </div>
            )}
          </div>
        )}

        {/* Streak motivational message */}
        {streakMessage && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium text-center py-1.5 px-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 text-orange-700 dark:text-orange-300 mb-3 border border-orange-100/50 dark:border-orange-800/20"
          >
            {streakMessage}
          </motion.div>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="font-serif text-sm font-semibold text-foreground">
          {year}年{month}月
        </span>
        <button
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
          className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Long-press hint */}
      <div className="px-4 pb-2">
        <p className="text-[10px] text-muted-foreground/60 text-center">
          长按日期可快速标记/取消止疼药
        </p>
      </div>

      {/* Calendar grid */}
      <div className="px-3 pb-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] font-medium text-muted-foreground/70 py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((cell, idx) => {
              if (!cell) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDay;

              return (
                <motion.button
                  key={cell.date}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    // Only handle click if long press wasn't triggered
                    if (!longPressTriggeredRef.current) {
                      setSelectedDay(
                        selectedDay === cell.date ? null : cell.date
                      );
                    }
                  }}
                  onPointerDown={() => handlePointerDown(cell.date, cell.status)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`
                    aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all select-none touch-none
                    ${getStatusColor(cell.status)}
                    ${isToday ? "ring-2 ring-terracotta ring-offset-1 ring-offset-card" : ""}
                    ${isSelected ? "ring-2 ring-foreground/40 ring-offset-1 ring-offset-card" : ""}
                    ${cell.status === "future" ? "cursor-default" : "cursor-pointer hover:opacity-80"}
                  `}
                  disabled={cell.status === "future"}
                >
                  <span
                    className={`text-xs font-medium leading-none ${
                      cell.status === "future"
                        ? "text-muted-foreground/30"
                        : ""
                    }`}
                  >
                    {cell.day}
                  </span>
                  {cell.status !== "future" &&
                    cell.status !== "no-schedule" && (
                      <span className="mt-0.5 opacity-80">
                        {getStatusIcon(cell.status, 10)}
                      </span>
                    )}
                  {cell.painkillerTaken && (
                    <>
                      {/* Prominent painkiller border ring */}
                      <span className="absolute inset-0 rounded-lg ring-2 ring-rose-400/70 ring-inset pointer-events-none" />
                      {/* Pill icon badge */}
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-card shadow-md flex items-center justify-center z-10" title="服用止疼药">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.5 20H14a2 2 0 002-2V6a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </span>
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected day detail with per-medication breakdown */}
      <AnimatePresence>
        {selectedDayData && selectedDayData.status !== "future" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <DayDetailPanel
              date={selectedDayData.date}
              status={selectedDayData.status}
              scheduledCount={selectedDayData.scheduledCount}
              takenCount={selectedDayData.takenCount}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">全部服药</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-muted-foreground">部分服药</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-400/80" />
          <span className="text-[10px] text-muted-foreground">未服药</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-muted/50 border border-border/50" />
          <span className="text-[10px] text-muted-foreground">无安排</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-md ring-2 ring-rose-400/70 ring-inset bg-rose-50 dark:bg-rose-950/30 relative">
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-card" />
          </div>
          <span className="text-[10px] text-muted-foreground">止疼药</span>
        </div>
      </div>
    </div>
  );
}
