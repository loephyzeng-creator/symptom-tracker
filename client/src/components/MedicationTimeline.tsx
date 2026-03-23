/**
 * MedicationTimeline — visual timeline showing daily medication taken/missed status
 * Displayed in the history view
 *
 * Implementation note: The static/mock layer's `timeline.useQuery` only supports
 * per-medication queries (with reminderId). This component fetches the list of
 * medications first, then uses per-medication queries via child components to
 * assemble the full timeline.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, X, Minus, ChevronLeft, ChevronRight, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLocalDateStr } from "@shared/timezone";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDayShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()}`;
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS[d.getDay()];
}

/** Per-medication timeline entry (from mock layer V2e) */
interface MedTimelineDay {
  date: string;
  times: Array<{ timeIndex: number; taken: boolean; takenAt: string | null }>;
}

/** Normalized per-medication timeline status for a single day */
interface MedDayStatus {
  /** "taken" if all scheduled times taken, "missed" if none taken, "partial" if some taken */
  status: "taken" | "missed" | "partial" | "not-scheduled";
}

/** Assembled timeline data for the whole table */
interface AssembledTimeline {
  medications: string[];
  days: Array<{
    date: string;
    medications: MedDayStatus[];
  }>;
}

/**
 * Helper component that fetches timeline data for a single medication and
 * reports it back via onData callback.
 */
function SingleMedTimelineLoader({
  reminderId,
  startDate,
  endDate,
  onData,
}: {
  reminderId: number;
  startDate: string;
  endDate: string;
  onData: (reminderId: number, days: MedTimelineDay[]) => void;
}) {
  const { data } = trpc.medReminders.timeline.useQuery(
    { reminderId, startDate, endDate } as Parameters<typeof trpc.medReminders.timeline.useQuery>[0],
    { staleTime: 60_000 }
  );

  useEffect(() => {
    if (data !== undefined) {
      // data from mock layer is MedTimelineDay[] when reminderId is provided
      const days = Array.isArray(data) ? (data as MedTimelineDay[]) : [];
      onData(reminderId, days);
    }
  }, [data, reminderId, onData]);

  return null;
}

export default function MedicationTimeline() {
  const [monthOffset, setMonthOffset] = useState(0);

  const { startDate, endDate, monthLabel, allDates } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + monthOffset;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    // Build list of all dates in the month
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(getLocalDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return {
      startDate: getLocalDateStr(start),
      endDate: getLocalDateStr(end),
      monthLabel: `${start.getFullYear()}年${start.getMonth() + 1}月`,
      allDates: dates,
    };
  }, [monthOffset]);

  // Fetch all active medication reminders
  const { data: medList, isLoading: listLoading } =
    trpc.medReminders.list.useQuery(undefined, { staleTime: 60_000 });

  // Per-medication timeline data keyed by reminderId
  const [perMedData, setPerMedData] = useState<
    Record<number, MedTimelineDay[]>
  >({});

  // Reset per-med data when month changes
  useEffect(() => {
    setPerMedData({});
  }, [startDate, endDate]);

  const handleMedData = useMemo(
    () => (reminderId: number, days: MedTimelineDay[]) => {
      setPerMedData((prev) => ({ ...prev, [reminderId]: days }));
    },
    []
  );

  // Filter to active, non-archived medications
  // Note: isActive/isArchived are mock-layer fields not in the server schema;
  // use 'as any' to access them at runtime while keeping TypeScript happy.
  const activeMeds = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((medList ?? []) as any[]).filter(
        (m: any) =>
          (m.isActive === undefined || m.isActive === 1) &&
          (m.isArchived === undefined || m.isArchived === 0)
      ),
    [medList]
  );

  // Assemble the full timeline once we have all per-med data
  const assembled = useMemo<AssembledTimeline | null>(() => {
    if (activeMeds.length === 0) return null;
    // Only assemble when all meds have reported data
    const allLoaded = activeMeds.every(
      (m: { id: number }) => perMedData[m.id] !== undefined
    );
    if (!allLoaded) return null;

    const medications = activeMeds.map(
      (m: { medicationName: string }) => m.medicationName
    );

    const days = allDates.map((date) => {
      const medStatuses: MedDayStatus[] = activeMeds.map(
        (m: { id: number }) => {
          const medDays = perMedData[m.id] ?? [];
          const dayEntry = medDays.find((d) => d.date === date);
          if (!dayEntry) {
            return { status: "not-scheduled" as const };
          }
          const scheduledTimes = dayEntry.times;
          if (scheduledTimes.length === 0) {
            return { status: "not-scheduled" as const };
          }
          const takenCount = scheduledTimes.filter((t) => t.taken).length;
          if (takenCount === 0) {
            return { status: "missed" as const };
          }
          if (takenCount === scheduledTimes.length) {
            return { status: "taken" as const };
          }
          return { status: "partial" as const };
        }
      );
      return { date, medications: medStatuses };
    });

    return { medications, days };
  }, [activeMeds, perMedData, allDates]);

  const isLoading = listLoading || (activeMeds.length > 0 && assembled === null);

  // Stats
  const { totalScheduled, totalTaken, adherenceRate } = useMemo(() => {
    if (!assembled) return { totalScheduled: 0, totalTaken: 0, adherenceRate: 0 };
    const totalScheduled = assembled.days.reduce(
      (sum, day) =>
        sum + day.medications.filter((m) => m.status !== "not-scheduled").length,
      0
    );
    const totalTaken = assembled.days.reduce(
      (sum, day) =>
        sum +
        day.medications.filter(
          (m) => m.status === "taken" || m.status === "partial"
        ).length,
      0
    );
    const adherenceRate =
      totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;
    return { totalScheduled, totalTaken, adherenceRate };
  }, [assembled]);

  return (
    <div className="space-y-4">
      {/* Hidden loaders for per-medication timeline data */}
      {activeMeds.map((m: { id: number }) => (
        <SingleMedTimelineLoader
          key={m.id}
          reminderId={m.id}
          startDate={startDate}
          endDate={endDate}
          onData={handleMedData}
        />
      ))}

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-terracotta border-t-transparent rounded-full" />
          <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
        </div>
      ) : !assembled || assembled.medications.length === 0 ? (
        <div className="text-center py-12">
          <Pill className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无用药提醒数据</p>
          <p className="text-xs text-muted-foreground mt-1">
            请先在设置中添加用药提醒
          </p>
        </div>
      ) : (
        <>
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
                  {assembled.days.map((day) => {
                    const isToday = day.date === getLocalDateStr();
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
                {assembled.medications.map((medName, medIdx) => (
                  <tr key={medName} className="border-t border-border/30">
                    <td
                      className="py-2 px-2 font-medium text-foreground sticky left-0 bg-background z-10 truncate max-w-[100px]"
                      title={medName}
                    >
                      {medName.length > 6 ? medName.slice(0, 6) + "…" : medName}
                    </td>
                    {assembled.days.map((day) => {
                      const med = day.medications[medIdx];
                      const isToday = day.date === getLocalDateStr();
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
                          ) : med?.status === "partial" ? (
                            <div className="w-5 h-5 mx-auto rounded-full bg-chart-4/20 flex items-center justify-center">
                              <Check className="w-3 h-3 text-chart-4" />
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

          <div className="text-xs text-muted-foreground text-center mt-2">
            提示：向左右滑动可查看更多日期
          </div>
        </>
      )}
    </div>
  );
}
