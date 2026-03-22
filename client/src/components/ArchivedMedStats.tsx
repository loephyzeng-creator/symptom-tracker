import { trpc } from "@/lib/trpc";
import { CalendarCheck, TrendingUp } from "lucide-react";

interface ArchivedMedStatsProps {
  reminderId: number;
}

export default function ArchivedMedStats({ reminderId }: ArchivedMedStatsProps) {
  const { data, isLoading } = trpc.medReminders.archivedStats.useQuery(
    { reminderId },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="pl-7 mt-1.5">
        <div className="h-4 w-40 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.totalDays === 0) {
    return (
      <div className="pl-7 mt-1.5">
        <span className="text-xs text-muted-foreground/60">暂无用药记录</span>
      </div>
    );
  }

  const rateColor =
    data.adherenceRate >= 80
      ? "text-green-500"
      : data.adherenceRate >= 50
        ? "text-yellow-500"
        : "text-red-400";

  return (
    <div className="flex items-center gap-3 pl-7 mt-1.5 flex-wrap">
      <div className="flex items-center gap-1">
        <CalendarCheck className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          服用 <span className="text-foreground font-medium">{data.takenDays}</span>/{data.totalDays} 天
        </span>
      </div>
      <div className="flex items-center gap-1">
        <TrendingUp className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          依从率 <span className={`font-medium ${rateColor}`}>{data.adherenceRate}%</span>
        </span>
      </div>
    </div>
  );
}
