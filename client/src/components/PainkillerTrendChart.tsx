/**
 * PainkillerTrendChart — Mini line chart showing monthly painkiller usage trend
 * Displays weekly painkiller usage frequency for the current month
 * with headache attack level correlation.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { Pill, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

export default function PainkillerTrendChart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Get calendar data which includes painkillerTaken per day
  const { data: calendarData, isLoading } = trpc.medReminders.checkInCalendar.useQuery(
    { year, month },
    { staleTime: 60_000 }
  );

  // Get painkiller limit setting
  const { data: usageData } = trpc.entries.painkillerUsage.useQuery(
    { date: todayStr },
    { staleTime: 60_000 }
  );

  const limit = usageData?.limit ?? 10;

  // Build weekly data from calendar
  const { weeklyData, totalDays, trend } = useMemo(() => {
    if (!calendarData?.days) return { weeklyData: [], totalDays: 0, trend: "stable" as const };

    const pastDays = calendarData.days.filter(
      (d) => d.status !== "future"
    );

    // Group by week number within the month
    const weeks: { weekLabel: string; painkillerDays: number; totalDays: number; dates: string[] }[] = [];
    let currentWeek: typeof weeks[0] | null = null;
    let weekNum = 1;

    for (const day of pastDays) {
      const d = new Date(day.date + "T00:00:00");
      const dayOfWeek = d.getDay();

      // Start new week on Monday (or first day of month)
      if (!currentWeek || (dayOfWeek === 1 && currentWeek.dates.length > 0)) {
        if (currentWeek) weeks.push(currentWeek);
        currentWeek = {
          weekLabel: `第${weekNum}周`,
          painkillerDays: 0,
          totalDays: 0,
          dates: [],
        };
        weekNum++;
      }

      currentWeek.totalDays++;
      currentWeek.dates.push(day.date);
      if (day.painkillerTaken) {
        currentWeek.painkillerDays++;
      }
    }
    if (currentWeek && currentWeek.dates.length > 0) {
      weeks.push(currentWeek);
    }

    const totalPainkillerDays = pastDays.filter((d) => d.painkillerTaken).length;

    // Determine trend
    let trendDir: "up" | "down" | "stable" = "stable";
    if (weeks.length >= 2) {
      const lastWeek = weeks[weeks.length - 1];
      const prevWeek = weeks[weeks.length - 2];
      const lastRate = lastWeek.totalDays > 0 ? lastWeek.painkillerDays / lastWeek.totalDays : 0;
      const prevRate = prevWeek.totalDays > 0 ? prevWeek.painkillerDays / prevWeek.totalDays : 0;
      if (lastRate > prevRate + 0.1) trendDir = "up";
      else if (lastRate < prevRate - 0.1) trendDir = "down";
    }

    return {
      weeklyData: weeks.map((w) => ({
        name: w.weekLabel,
        days: w.painkillerDays,
        total: w.totalDays,
        rate: w.totalDays > 0 ? Math.round((w.painkillerDays / w.totalDays) * 100) : 0,
      })),
      totalDays: totalPainkillerDays,
      trend: trendDir,
    };
  }, [calendarData]);

  if (isLoading) return null;
  if (!calendarData || weeklyData.length === 0) return null;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-red-500" : trend === "down" ? "text-emerald-500" : "text-muted-foreground";
  const trendLabel = trend === "up" ? "上升趋势" : trend === "down" ? "下降趋势" : "平稳";

  // Weekly limit reference (proportional to 10 days / ~4.3 weeks)
  const weeklyLimitRef = Math.round((limit / 30) * 7 * 10) / 10;

  const isOverLimit = totalDays >= limit;
  const isApproaching = totalDays >= limit * 0.7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="bg-card rounded-2xl p-4 shadow-sm border border-border/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isOverLimit
              ? "bg-red-100 dark:bg-red-950/30"
              : isApproaching
                ? "bg-orange-100 dark:bg-orange-950/30"
                : "bg-rose-100 dark:bg-rose-950/30"
          }`}>
            <Pill className={`w-4 h-4 ${
              isOverLimit ? "text-red-500" : isApproaching ? "text-orange-500" : "text-rose-500"
            }`} />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">本月止疼药趋势</h3>
            <p className="text-[10px] text-muted-foreground">{year}年{month}月</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="font-medium">{trendLabel}</span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
          isOverLimit
            ? "bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/30 text-red-600 dark:text-red-400"
            : isApproaching
              ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-800/30 text-orange-600 dark:text-orange-400"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200/50 dark:border-rose-800/30 text-rose-600 dark:text-rose-400"
        }`}>
          <Pill className="w-3 h-3" />
          本月 {totalDays} 天
        </div>
        <span className="text-[11px] text-muted-foreground">
          阈值 {limit} 天/30天
        </span>
        {isOverLimit && (
          <div className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
            <AlertTriangle className="w-3 h-3" />
            已超阈值
          </div>
        )}
      </div>

      {/* Mini chart */}
      <div className="h-[120px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="painkillerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isOverLimit ? "#ef4444" : "#f43f5e"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isOverLimit ? "#ef4444" : "#f43f5e"} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover text-popover-foreground border border-border/50 rounded-lg px-3 py-2 shadow-lg text-xs">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-rose-500">止疼药: {d.days} 天 / {d.total} 天</p>
                    <p className="text-muted-foreground">使用率: {d.rate}%</p>
                  </div>
                );
              }}
            />
            {weeklyLimitRef > 0 && (
              <ReferenceLine
                y={weeklyLimitRef}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: `周限${weeklyLimitRef.toFixed(1)}天`,
                  position: "right",
                  style: { fontSize: 9, fill: "#ef4444", opacity: 0.7 },
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="days"
              stroke={isOverLimit ? "#ef4444" : "#f43f5e"}
              strokeWidth={2}
              fill="url(#painkillerGradient)"
              dot={{ r: 4, fill: isOverLimit ? "#ef4444" : "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly breakdown */}
      <div className="flex items-center justify-between mt-2 px-1">
        {weeklyData.map((w, i) => (
          <div key={i} className="text-center">
            <div className={`text-xs font-semibold ${
              w.days >= 3 ? "text-red-500" : w.days >= 2 ? "text-orange-500" : w.days > 0 ? "text-rose-500" : "text-muted-foreground/50"
            }`}>
              {w.days}天
            </div>
            <div className="text-[9px] text-muted-foreground">{w.name}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
