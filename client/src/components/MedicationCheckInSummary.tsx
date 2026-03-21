/**
 * MedicationCheckInSummary — Shows medication check-in status for a given date.
 * Used in HistoryView to display which medications were taken/missed on that day.
 */
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Circle, Pill, Loader2 } from "lucide-react";

interface MedicationCheckInSummaryProps {
  date: string; // YYYY-MM-DD
}

export default function MedicationCheckInSummary({ date }: MedicationCheckInSummaryProps) {
  const { data: meds, isLoading } = trpc.medReminders.todayMeds.useQuery(
    { date },
    { refetchOnWindowFocus: false, staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>加载服药记录...</span>
      </div>
    );
  }

  if (!meds || meds.length === 0) {
    return null; // No reminders configured for this date
  }

  const takenCount = meds.filter((m: any) => m.taken).length;
  const totalCount = meds.length;
  const allTaken = takenCount === totalCount;

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Pill className="w-3 h-3 text-dusty-blue" />
        <span className="text-muted-foreground">服药打卡：</span>
        <span
          className={`font-medium ${
            allTaken
              ? "text-sage"
              : takenCount > 0
                ? "text-chart-4"
                : "text-muted-foreground"
          }`}
        >
          {takenCount}/{totalCount} 已服
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {meds.map((med: any) => {
          const medKey = `${med.reminderId}-${med.timeIndex ?? 0}`;
          return (
            <span
              key={medKey}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                med.taken
                  ? "bg-sage/10 text-sage border border-sage/20"
                  : "bg-muted/50 text-muted-foreground border border-border/40"
              }`}
            >
              {med.taken ? (
                <CheckCircle2 className="w-2.5 h-2.5" />
              ) : (
                <Circle className="w-2.5 h-2.5" />
              )}
              {med.name}
              {med.totalTimes > 1 && (
                <span className="opacity-60">#{med.timeIndex + 1}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
