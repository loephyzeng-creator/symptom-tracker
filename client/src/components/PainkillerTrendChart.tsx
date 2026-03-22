/**
 * PainkillerTrendChart — Mini line chart showing painkiller usage trend
 * Displays weekly painkiller usage frequency for the last 30 days (rolling window)
 * with headache attack level correlation.
 * Enhanced: threshold explanation, red highlight for over-limit, click to expand daily details.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
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
import { Pill, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Calendar } from "lucide-react";

interface WeekData {
  name: string;
  days: number;
  total: number;
  rate: number;
  startDate: string;
  endDate: string;
  dailyDetails: { date: string; dateLabel: string; painkillerTaken: boolean }[];
  overLimit: boolean;
}

export default function PainkillerTrendChart() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);

  // Get all entries — we'll filter to last 30 days on the client
  const { data: entries, isLoading: entriesLoading } = trpc.entries.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Get painkiller limit setting
  const { data: usageData } = trpc.entries.painkillerUsage.useQuery(
    { date: todayStr },
    { staleTime: 60_000 }
  );

  const limit = usageData?.limit ?? 10;

  // Build weekly data from last 30 days
  const { weeklyData, totalDays, trend, weeklyLimitRef } = useMemo(() => {
    if (!entries || entries.length === 0) return { weeklyData: [] as WeekData[], totalDays: 0, trend: "stable" as const, weeklyLimitRef: 0 };

    // Calculate the date 30 days ago
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Include today = 30 days

    const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;
    const todayStr2 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Filter entries to last 30 days
    const recentEntries = entries.filter(
      (e: any) => e.date >= thirtyDaysAgoStr && e.date <= todayStr2
    );

    // Build a map of date -> painkillerTaken for the 30-day window
    const painkillerMap = new Map<string, boolean>();
    for (const e of recentEntries) {
      painkillerMap.set(e.date, !!(e as any).painkillerTaken);
    }

    // Generate all 30 days and group into ~4 weeks
    const allDays: { date: string; dateLabel: string; painkillerTaken: boolean }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      if (d > today) break;
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dd = new Date(ds + "T00:00:00");
      allDays.push({
        date: ds,
        dateLabel: `${dd.getMonth() + 1}/${dd.getDate()}`,
        painkillerTaken: painkillerMap.get(ds) ?? false,
      });
    }

    // Group into 4 periods of ~7-8 days each
    const periodSize = Math.ceil(allDays.length / 4);
    const wkLimitRef = Math.round((limit / 30) * 7 * 10) / 10;

    const weeks: WeekData[] = [];

    for (let i = 0; i < 4; i++) {
      const start = i * periodSize;
      const end = Math.min(start + periodSize, allDays.length);
      if (start >= allDays.length) break;

      const periodDays = allDays.slice(start, end);
      const painkillerCount = periodDays.filter((d) => d.painkillerTaken).length;

      // Format date range label
      const startD = new Date(periodDays[0].date + "T00:00:00");
      const endD = new Date(periodDays[periodDays.length - 1].date + "T00:00:00");
      const startLabel = `${startD.getMonth() + 1}/${startD.getDate()}`;
      const endLabel = `${endD.getMonth() + 1}/${endD.getDate()}`;

      weeks.push({
        name: `${startLabel}-${endLabel}`,
        days: painkillerCount,
        total: periodDays.length,
        rate: periodDays.length > 0 ? Math.round((painkillerCount / periodDays.length) * 100) : 0,
        startDate: periodDays[0].date,
        endDate: periodDays[periodDays.length - 1].date,
        dailyDetails: periodDays,
        overLimit: painkillerCount > wkLimitRef,
      });
    }

    const totalPainkillerDays = allDays.filter((d) => d.painkillerTaken).length;

    // Determine trend
    let trendDir: "up" | "down" | "stable" = "stable";
    if (weeks.length >= 2) {
      const lastWeek = weeks[weeks.length - 1];
      const prevWeek = weeks[weeks.length - 2];
      const lastRate = lastWeek.total > 0 ? lastWeek.days / lastWeek.total : 0;
      const prevRate = prevWeek.total > 0 ? prevWeek.days / prevWeek.total : 0;
      if (lastRate > prevRate + 0.1) trendDir = "up";
      else if (lastRate < prevRate - 0.1) trendDir = "down";
    }

    return {
      weeklyData: weeks,
      totalDays: totalPainkillerDays,
      trend: trendDir,
      weeklyLimitRef: wkLimitRef,
    };
  }, [entries, limit]);

  if (entriesLoading) return null;
  if (!entries || weeklyData.length === 0) return null;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-red-500" : trend === "down" ? "text-emerald-500" : "text-muted-foreground";
  const trendLabel = trend === "up" ? "\u4e0a\u5347\u8d8b\u52bf" : trend === "down" ? "\u4e0b\u964d\u8d8b\u52bf" : "\u5e73\u7a33";

  const isOverLimit = totalDays >= limit;
  const isApproaching = totalDays >= limit * 0.7;

  const handlePeriodClick = (index: number) => {
    setExpandedPeriod(expandedPeriod === index ? null : index);
  };

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
            <h3 className="font-serif font-semibold text-sm">{"\u8fd130\u5929\u6b62\u75bc\u836f\u8d8b\u52bf"}</h3>
            <p className="text-[10px] text-muted-foreground">{"\u6eda\u52a8\u7edf\u8ba1\u6700\u8fd130\u5929"}</p>
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
          {"\u8fd130\u5929"} {totalDays} {"\u5929"}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {"\u9608\u503c"} {limit} {"\u5929/30\u5929"}
        </span>
        {isOverLimit && (
          <div className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {"\u5df2\u8d85\u9608\u503c"}
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
              <linearGradient id="painkillerGradientRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
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
                const d = payload[0].payload as WeekData;
                return (
                  <div className="bg-popover text-popover-foreground border border-border/50 rounded-lg px-3 py-2 shadow-lg text-xs">
                    <p className="font-medium">{d.name}</p>
                    <p className={d.overLimit ? "text-red-500 font-semibold" : "text-rose-500"}>
                      {"\u6b62\u75bc\u836f"}: {d.days} {"\u5929"} / {d.total} {"\u5929"}
                      {d.overLimit ? " \u26a0\ufe0f \u8d85\u9650" : ""}
                    </p>
                    <p className="text-muted-foreground">{"\u4f7f\u7528\u7387"}: {d.rate}%</p>
                    <p className="text-muted-foreground mt-1">{"\u70b9\u51fb\u4e0b\u65b9\u67e5\u770b\u6bcf\u65e5\u8be6\u60c5"}</p>
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
                  value: `\u9608\u503c ${weeklyLimitRef.toFixed(1)}\u5929/\u5468`,
                  position: "insideTopLeft",
                  style: { fontSize: 9, fill: "#ef4444", opacity: 0.7 },
                  offset: 4,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="days"
              stroke={isOverLimit ? "#ef4444" : "#f43f5e"}
              strokeWidth={2}
              fill="url(#painkillerGradient)"
              dot={({ cx, cy, payload }: any) => {
                const d = payload as WeekData;
                const color = d.overLimit ? "#ef4444" : "#f43f5e";
                return (
                  <circle
                    key={d.name}
                    cx={cx}
                    cy={cy}
                    r={d.overLimit ? 5 : 4}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly breakdown - clickable */}
      <div className="flex items-center justify-between mt-2 px-1">
        {weeklyData.map((w, i) => (
          <button
            key={i}
            onClick={() => handlePeriodClick(i)}
            className={`text-center px-2 py-1 rounded-lg transition-colors ${
              expandedPeriod === i
                ? "bg-muted"
                : "hover:bg-muted/50"
            } ${w.overLimit ? "ring-1 ring-red-300 dark:ring-red-800" : ""}`}
          >
            <div className={`text-xs font-semibold ${
              w.overLimit ? "text-red-500" : w.days >= 2 ? "text-orange-500" : w.days > 0 ? "text-rose-500" : "text-muted-foreground/50"
            }`}>
              {w.days}{"\u5929"}
            </div>
            <div className="text-[9px] text-muted-foreground">{w.name}</div>
            {expandedPeriod === i ? (
              <ChevronUp className="w-3 h-3 mx-auto text-muted-foreground mt-0.5" />
            ) : (
              <ChevronDown className="w-3 h-3 mx-auto text-muted-foreground/30 mt-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Expanded daily details */}
      <AnimatePresence>
        {expandedPeriod !== null && weeklyData[expandedPeriod] && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {weeklyData[expandedPeriod].name} {"\u6bcf\u65e5\u8be6\u60c5"}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weeklyData[expandedPeriod].dailyDetails.map((day) => (
                  <div
                    key={day.date}
                    className={`text-center py-1.5 rounded-lg text-[10px] ${
                      day.painkillerTaken
                        ? "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold border border-red-200/50 dark:border-red-800/30"
                        : "bg-background text-muted-foreground border border-border/30"
                    }`}
                  >
                    <div>{day.dateLabel}</div>
                    <div className="mt-0.5">
                      {day.painkillerTaken ? (
                        <Pill className="w-3 h-3 mx-auto" />
                      ) : (
                        <span className="text-[9px]">-</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Threshold explanation */}
      <div className="mt-3 px-1">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {"\u865a\u7ebf\u4e3a\u6bcf\u5468\u5efa\u8bae\u4e0a\u9650\uff08\u6839\u636e30\u5929\u9608\u503c"}{limit}{"\u5929\u6362\u7b97\uff09\uff0c\u8d85\u8fc7\u53ef\u80fd\u589e\u52a0\u836f\u7269\u8fc7\u5ea6\u4f7f\u7528\u6027\u5934\u75db\uff08MOH\uff09\u98ce\u9669\u3002\u5efa\u8bae\u5c3d\u91cf\u5c06\u6b62\u75bc\u836f\u4f7f\u7528\u63a7\u5236\u5728\u9608\u503c\u4ee5\u5185\uff0c\u5982\u6709\u7591\u95ee\u8bf7\u54a8\u8be2\u533b\u751f\u3002"}
        </p>
      </div>
    </motion.div>
  );
}
