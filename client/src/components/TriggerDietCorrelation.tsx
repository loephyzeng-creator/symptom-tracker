/**
 * TriggerDietCorrelation — Shows correlation analysis between "上火" trigger days
 * and symptom severity, with weekly trend tracking.
 * Placed in the triggers tab of the statistics page.
 */
import { useMemo, useState } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Info,
} from "lucide-react";

interface Props {
  entries: SymptomEntry[];
}

const KEY_SYMPTOMS = [
  { key: "dizziness", label: "头晕", color: "#b87a4b", invert: true },
  { key: "headache", label: "头痛", color: "#c45c5c", invert: true },
  { key: "fatigue", label: "疲劳", color: "#7a9e7e", invert: true },
  { key: "anxiety", label: "焦虑", color: "#9b6b8a", invert: true },
  { key: "sleepQuality", label: "睡眠", color: "#7a9eb8", invert: false },
  { key: "mood", label: "心情", color: "#8b6bbf", invert: false },
];

export default function TriggerDietCorrelation({ entries }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Filter entries that have "上火" trigger
  const analysis = useMemo(() => {
    if (entries.length < 3) return null;

    const fireEntries = entries.filter((e) => e.triggers.includes("上火"));
    const nonFireEntries = entries.filter((e) => !e.triggers.includes("上火"));

    if (fireEntries.length < 1) return null;

    // Overall stats
    const fireDays = fireEntries.length;
    const totalDays = entries.length;
    const firePercentage = Math.round((fireDays / totalDays) * 100);

    // Symptom comparison
    const symptomComparison = KEY_SYMPTOMS.map((s) => {
      const avgFire =
        fireEntries.length > 0
          ? fireEntries.reduce((sum, e) => sum + ((e as any)[s.key] ?? 0), 0) /
            fireEntries.length
          : 0;
      const avgNonFire =
        nonFireEntries.length > 0
          ? nonFireEntries.reduce((sum, e) => sum + ((e as any)[s.key] ?? 0), 0) /
            nonFireEntries.length
          : 0;
      const diff = Math.round((avgFire - avgNonFire) * 10) / 10;
      const isWorse = s.invert ? diff > 0.3 : diff < -0.3;
      const isBetter = s.invert ? diff < -0.3 : diff > 0.3;

      return {
        ...s,
        avgFire: Math.round(avgFire * 10) / 10,
        avgNonFire: Math.round(avgNonFire * 10) / 10,
        diff,
        impact: isWorse ? ("worse" as const) : isBetter ? ("better" as const) : ("neutral" as const),
      };
    });

    // Weekly trend: group entries by week and count fire days per week
    const weeklyData: { week: string; fireDays: number; totalDays: number; avgDizziness: number }[] = [];
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    // Group by ISO week
    const weekMap = new Map<string, { fire: number; total: number; dizzinessSum: number }>();
    sortedEntries.forEach((e) => {
      const d = new Date(e.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

      const existing = weekMap.get(weekKey) || { fire: 0, total: 0, dizzinessSum: 0 };
      existing.total++;
      if (e.triggers.includes("上火")) existing.fire++;
      existing.dizzinessSum += e.dizziness;
      weekMap.set(weekKey, existing);
    });

    weekMap.forEach((v, k) => {
      weeklyData.push({
        week: k,
        fireDays: v.fire,
        totalDays: v.total,
        avgDizziness: Math.round((v.dizzinessSum / v.total) * 10) / 10,
      });
    });

    // Only show last 8 weeks
    const recentWeekly = weeklyData.slice(-8);

    // Trend: compare last 2 weeks fire frequency
    let trend: "improving" | "worsening" | "stable" = "stable";
    if (recentWeekly.length >= 2) {
      const lastWeek = recentWeekly[recentWeekly.length - 1];
      const prevWeek = recentWeekly[recentWeekly.length - 2];
      const lastRate = lastWeek.fireDays / lastWeek.totalDays;
      const prevRate = prevWeek.fireDays / prevWeek.totalDays;
      if (lastRate < prevRate - 0.1) trend = "improving";
      else if (lastRate > prevRate + 0.1) trend = "worsening";
    }

    return {
      fireDays,
      totalDays,
      firePercentage,
      symptomComparison,
      weeklyData: recentWeekly,
      trend,
    };
  }, [entries]);

  if (!analysis) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">上火与症状关联分析</h3>
            <p className="text-[11px] text-muted-foreground">
              {analysis.fireDays} 天上火 / {analysis.totalDays} 天记录（{analysis.firePercentage}%）
              {analysis.trend === "improving" && (
                <span className="text-sage ml-1">↓ 趋势改善</span>
              )}
              {analysis.trend === "worsening" && (
                <span className="text-destructive ml-1">↑ 趋势加重</span>
              )}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/50"
          >
            <div className="p-4 space-y-5">
              {/* Symptom comparison table */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    上火日 vs 非上火日的平均症状评分对比
                  </span>
                </div>

                {/* Header row */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] text-muted-foreground pb-1.5 border-b border-border/30 mb-1.5">
                  <span>症状</span>
                  <span className="text-right w-14">上火日</span>
                  <span className="text-right w-14">非上火日</span>
                  <span className="text-right w-14">变化</span>
                </div>

                {analysis.symptomComparison.map((s) => (
                  <div
                    key={s.key}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-xs">{s.label}</span>
                    </div>
                    <span
                      className={`text-xs font-medium text-right w-14 ${
                        s.impact === "worse" ? "text-destructive" : ""
                      }`}
                    >
                      {s.avgFire}
                    </span>
                    <span className="text-xs text-muted-foreground text-right w-14">
                      {s.avgNonFire}
                    </span>
                    <div className="flex items-center justify-end gap-1 w-14">
                      {s.impact === "worse" && (
                        <>
                          <TrendingUp className="w-3 h-3 text-destructive" />
                          <span className="text-xs font-medium text-destructive">
                            +{Math.abs(s.diff)}
                          </span>
                        </>
                      )}
                      {s.impact === "better" && (
                        <>
                          <TrendingDown className="w-3 h-3 text-sage" />
                          <span className="text-xs font-medium text-sage">
                            {s.diff > 0 ? "+" : ""}
                            {s.diff}
                          </span>
                        </>
                      )}
                      {s.impact === "neutral" && (
                        <>
                          <Minus className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {s.diff > 0 ? "+" : ""}
                            {s.diff}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Weekly trend chart */}
              {analysis.weeklyData.length >= 2 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      每周上火天数与头晕趋势
                    </span>
                  </div>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysis.weeklyData} barCategoryGap="20%">
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border)" }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "上火天数",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 10, fill: "var(--muted-foreground)" },
                          }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 10]}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          label={{
                            value: "头晕均值",
                            angle: 90,
                            position: "insideRight",
                            style: { fontSize: 10, fill: "var(--muted-foreground)" },
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            fontSize: 11,
                          }}
                          formatter={(value: number, name: string) => [
                            value,
                            name === "fireDays" ? "上火天数" : "头晕均值",
                          ]}
                          labelFormatter={(label) => `第 ${label} 周`}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={28}
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 10 }}
                          formatter={(value) =>
                            value === "fireDays" ? "上火天数" : "头晕均值"
                          }
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="fireDays"
                          name="fireDays"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        >
                          {analysis.weeklyData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.fireDays > 0 ? "#ef4444" : "#e5e7eb"}
                              fillOpacity={0.7}
                            />
                          ))}
                        </Bar>
                        <Bar
                          yAxisId="right"
                          dataKey="avgDizziness"
                          name="avgDizziness"
                          radius={[4, 4, 0, 0]}
                          fill="#b87a4b"
                          fillOpacity={0.5}
                          maxBarSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Summary insight */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {analysis.symptomComparison.find(
                    (s) => s.key === "dizziness" && s.impact === "worse"
                  ) ? (
                    <span>
                      数据显示<span className="text-destructive font-medium">上火时头晕明显加重</span>
                      （上火日均值 {analysis.symptomComparison.find((s) => s.key === "dizziness")?.avgFire}
                      ，非上火日 {analysis.symptomComparison.find((s) => s.key === "dizziness")?.avgNonFire}
                      ）。建议上火期间注意清淡饮食，多喝薄荷水、菊花茶等清热饮品，避免辛辣刺激食物。
                    </span>
                  ) : analysis.fireDays < 3 ? (
                    <span>
                      目前上火记录较少（{analysis.fireDays}天），继续记录以获得更准确的关联分析。
                      建议每次感觉上火时都勾选该诱因。
                    </span>
                  ) : (
                    <span>
                      根据现有数据，上火对症状的影响暂不明显。建议继续坚持记录，
                      数据越多分析越准确。
                    </span>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
