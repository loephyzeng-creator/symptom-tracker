/**
 * MedicationTimeline — visual timeline showing daily medication taken/missed status
 * Displayed in the history view
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, X, Minus, ChevronLeft, ChevronRight, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function formatDayShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS[d.getDay()];
}

export default function MedicationTimeline() {
  // Default to current month
  const [monthOffset, setMonthOffset] = useState(0);

  const { startDate, endDate, monthLabel } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + monthOffset;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // Last day of month
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      monthLabel: `${start.getFullYear()}年${start.getMonth() + 1}月`,
    };
  }, [monthOffset]);

  const { data, isLoading } = trpc.medReminders.timeline.useQuery(
    { startDate, endDate },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-5 h-5 border-2 border-terracotta border-t-transparent rounded-full" />
        <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (!data || data.medications.length === 0) {
    return (
      <div className="text-center py-12">
        <Pill className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">暂无用药提醒数据</p>
        <p className="text-xs text-muted-foreground mt-1">
          请先在设置中添加用药提醒
        </p>
      </div>
    );
  }

  // Calculate stats for this month
  const totalScheduled = data.days.reduce(
    (sum, day) =>
      sum +
      day.medications.filter((m) => m.status !== "not-scheduled").length,
    0
  );
  const totalTaken = data.days.reduce(
    (sum, day) =>
      sum + day.medications.filter((m) => m.status === "taken").length,
    0
  );
  const adherenceRate =
    totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonthOffset((o) => o - 1)}
          className="rounded-full"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <div className="font-serif font-medium">{monthLabel}</div>
          <div className="text-xs text-muted-foreground">
            服药率{" "}
            <span
              className={
                adherenceRate >= 80
                  ? "text-sage font-medium"
                  : adherenceRate >= 50
                  ? "text-chart-4 font-medium"
                  : "text-terracotta font-medium"
              }
            >
              {adherenceRate}%
            </span>{" "}
            ({totalTaken}/{totalScheduled})
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonthOffset((o) => o + 1)}
          disabled={monthOffset >= 0}
          className="rounded-full"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-sage/80" />
          <span>已服药</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-terracotta/80" />
          <span>漏服</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>无需服药</span>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground sticky left-0 bg-background z-10 min-w-[80px]">
                药品
              </th>
              {data.days.map((day) => {
                const isToday =
                  day.date ===
                  new Date().toISOString().slice(0, 10);
                return (
                  <th
                    key={day.date}
                    className={`text-center py-1 px-0.5 min-w-[28px] ${
                      isToday ? "bg-terracotta/10 rounded-t-lg" : ""
                    }`}
                  >
                    <div className="text-[10px] text-muted-foreground">
                      {getDayOfWeek(day.date)}
                    </div>
                    <div
                      className={`text-[11px] ${
                        isToday
                          ? "font-bold text-terracotta"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatDayShort(day.date)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.medications.map((medName, medIdx) => (
              <tr key={medName} className="border-t border-border/30">
                <td className="py-2 px-2 font-medium text-foreground sticky left-0 bg-background z-10 truncate max-w-[100px]" title={medName}>
                  {medName.length > 6
                    ? medName.slice(0, 6) + "…"
                    : medName}
                </td>
                {data.days.map((day) => {
                  const med = day.medications[medIdx];
                  const isToday =
                    day.date ===
                    new Date().toISOString().slice(0, 10);
                  return (
                    <td
                      key={day.date}
                      className={`text-center py-1.5 px-0.5 ${
                        isToday ? "bg-terracotta/5" : ""
                      }`}
                    >
                      {med?.status === "taken" ? (
                        <div className="w-5 h-5 mx-auto rounded-full bg-sage/20 flex items-center justify-center">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                      ) : med?.status === "missed" ? (
                        <div className="w-5 h-5 mx-auto rounded-full bg-terracotta/20 flex items-center justify-center">
                          <X className="w-3 h-3 text-terracotta" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                          <Minus className="w-3 h-3 text-muted-foreground/40" />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-day summary row */}
      <div className="text-xs text-muted-foreground text-center mt-2">
        提示：向左右滑动可查看更多日期
      </div>
    </div>
  );
}
