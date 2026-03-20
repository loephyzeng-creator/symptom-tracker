/**
 * Calendar View — monthly calendar with color-coded symptom severity
 * Each day cell shows a color from green (good) to red (bad) based on overall score
 */
import { useState, useMemo } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface CalendarViewProps {
  entries: SymptomEntry[];
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function getOverallScore(entry: SymptomEntry): number {
  const badAvg =
    (entry.dizziness +
      entry.headache +
      entry.anxiety +
      entry.fatigue +
      entry.photosensitivity +
      entry.motionSickness +
      entry.palpitations) /
    7;
  const goodAvg = (entry.sleepQuality + entry.mood) / 2;
  return Math.round(((10 - badAvg) * 0.6 + goodAvg * 0.4) * 10) / 10;
}

function getScoreColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 8) return { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300" };
  if (score >= 7) return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" };
  if (score >= 6) return { bg: "bg-lime-50", text: "text-lime-700", ring: "ring-lime-200" };
  if (score >= 5) return { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" };
  if (score >= 4) return { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" };
  if (score >= 3) return { bg: "bg-orange-100", text: "text-orange-800", ring: "ring-orange-300" };
  return { bg: "bg-red-100", text: "text-red-800", ring: "ring-red-300" };
}

function getScoreLabel(score: number): string {
  if (score >= 7) return "不错";
  if (score >= 5) return "一般";
  if (score >= 3) return "较差";
  return "很差";
}

function formatMonth(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

export default function CalendarView({ entries, onSelectDate }: CalendarViewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Build a map of date -> entry for quick lookup
  const entryMap = useMemo(() => {
    const map = new Map<string, SymptomEntry>();
    entries.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  // Calendar grid data
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday = 0, Sunday = 6
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const days: Array<{ day: number; dateStr: string; entry?: SymptomEntry } | null> = [];

    // Padding for days before the 1st
    for (let i = 0; i < startWeekday; i++) {
      days.push(null);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateKey(viewYear, viewMonth, d);
      days.push({ day: d, dateStr: ds, entry: entryMap.get(ds) });
    }

    return days;
  }, [viewYear, viewMonth, entryMap]);

  // Month stats
  const monthStats = useMemo(() => {
    const monthEntries = calendarDays
      .filter((d): d is NonNullable<typeof d> => d !== null && d.entry !== undefined)
      .map((d) => d.entry!);

    if (monthEntries.length === 0) return null;

    const scores = monthEntries.map(getOverallScore);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const best = Math.max(...scores);
    const worst = Math.min(...scores);

    return { count: monthEntries.length, avg, best, worst };
  }, [calendarDays]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(null);
  };

  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const selectedEntry = selectedDay ? entryMap.get(selectedDay) : null;

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <h3 className="font-serif font-semibold text-base">
              {formatMonth(viewYear, viewMonth)}
            </h3>
            {viewYear !== today.getFullYear() || viewMonth !== today.getMonth() ? (
              <button
                onClick={goToToday}
                className="text-[10px] text-terracotta hover:underline"
              >
                回到今天
              </button>
            ) : null}
          </div>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="text-center text-[10px] font-medium text-muted-foreground py-1"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }

            const isToday = cell.dateStr === todayStr;
            const isSelected = cell.dateStr === selectedDay;
            const hasEntry = !!cell.entry;
            const score = hasEntry ? getOverallScore(cell.entry!) : null;
            const colors = score !== null ? getScoreColor(score) : null;

            return (
              <button
                key={cell.dateStr}
                onClick={() => {
                  setSelectedDay(isSelected ? null : cell.dateStr);
                }}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative
                  ${isSelected ? "ring-2 ring-terracotta scale-105" : ""}
                  ${isToday && !isSelected ? "ring-1 ring-terracotta/40" : ""}
                  ${hasEntry && colors ? `${colors.bg} ${colors.text}` : "hover:bg-muted/50 text-muted-foreground"}
                `}
              >
                <span className={`font-medium ${isToday ? "font-bold" : ""}`}>
                  {cell.day}
                </span>
                {hasEntry && score !== null && (
                  <span className="text-[8px] leading-none mt-0.5 opacity-80">
                    {score.toFixed(0)}
                  </span>
                )}
                {isToday && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-terracotta" />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Month Summary */}
      {monthStats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-terracotta" />
            <h3 className="font-serif font-semibold text-sm">本月概览</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-lg font-serif font-bold text-terracotta">{monthStats.count}</div>
              <div className="text-[10px] text-muted-foreground">记录天数</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-serif font-bold text-foreground">{monthStats.avg}</div>
              <div className="text-[10px] text-muted-foreground">平均状态</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-serif font-bold text-sage">{monthStats.best}</div>
              <div className="text-[10px] text-muted-foreground">最佳</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-serif font-bold text-destructive">{monthStats.worst}</div>
              <div className="text-[10px] text-muted-foreground">最差</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Selected Day Detail */}
      {selectedDay && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif font-semibold text-sm">
              {selectedDay.replace(/-/g, "/")} 详情
            </h3>
            {selectedEntry ? (
              <button
                onClick={() => onSelectDate(selectedDay)}
                className="text-xs text-terracotta hover:underline"
              >
                编辑记录
              </button>
            ) : (
              <button
                onClick={() => onSelectDate(selectedDay)}
                className="text-xs text-terracotta hover:underline"
              >
                添加记录
              </button>
            )}
          </div>

          {selectedEntry ? (
            <div className="space-y-3">
              {/* Score */}
              <div className="flex items-center gap-3">
                <div
                  className={`text-2xl font-serif font-bold ${
                    getScoreColor(getOverallScore(selectedEntry)).text
                  }`}
                >
                  {getOverallScore(selectedEntry)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {getScoreLabel(getOverallScore(selectedEntry))}
                </div>
              </div>

              {/* Symptom Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">头晕</span>
                  <span className="font-medium">{selectedEntry.dizziness}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">头痛</span>
                  <span className="font-medium">{selectedEntry.headache}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">睡眠</span>
                  <span className="font-medium">{selectedEntry.sleepQuality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">焦虑</span>
                  <span className="font-medium">{selectedEntry.anxiety}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">疲劳</span>
                  <span className="font-medium">{selectedEntry.fatigue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">畏光</span>
                  <span className="font-medium">{selectedEntry.photosensitivity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">运动敏感</span>
                  <span className="font-medium">{selectedEntry.motionSickness}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">心慌</span>
                  <span className="font-medium">{selectedEntry.palpitations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">心情</span>
                  <span className="font-medium">{selectedEntry.mood}</span>
                </div>
              </div>

              {/* Triggers */}
              {selectedEntry.triggers && selectedEntry.triggers.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">诱因：</span>
                  <span className="ml-1">{selectedEntry.triggers.join("、")}</span>
                </div>
              )}

              {/* Medications */}
              {Array.isArray(selectedEntry.medications) &&
                selectedEntry.medications.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">用药：</span>
                    <span className="ml-1">
                      {selectedEntry.medications
                        .map((m: any) => (m.dosage ? `${m.name} ${m.dosage}` : m.name))
                        .join("、")}
                    </span>
                  </div>
                )}

              {/* Notes */}
              {selectedEntry.notes && (
                <div className="text-xs">
                  <span className="text-muted-foreground">备注：</span>
                  <span className="ml-1">{selectedEntry.notes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">当天没有记录</p>
              <p className="text-xs text-muted-foreground mt-1">点击上方按钮添加</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Color Legend */}
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <span>差</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-4 rounded bg-red-100" />
          <div className="w-4 h-4 rounded bg-orange-100" />
          <div className="w-4 h-4 rounded bg-orange-50" />
          <div className="w-4 h-4 rounded bg-amber-50" />
          <div className="w-4 h-4 rounded bg-lime-50" />
          <div className="w-4 h-4 rounded bg-emerald-50" />
          <div className="w-4 h-4 rounded bg-emerald-100" />
        </div>
        <span>好</span>
      </div>
    </div>
  );
}
