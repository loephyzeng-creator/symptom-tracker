/**
 * MedicationConsumptionChart — Monthly medication consumption trend chart
 * Shows a stacked bar chart of medication usage per month (last 6 months).
 * Each bar segment represents a different medication, with totals on top.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// Warm palette that matches the app's Scandinavian design
const MED_COLORS = [
  "#c2785c", // terracotta
  "#8faa7b", // sage
  "#7ba5b5", // dusty blue
  "#d4a574", // warm sand
  "#a0849c", // muted purple
  "#c49a6c", // amber
  "#6b9e9e", // teal
  "#d48b8b", // soft coral
  "#9bb88a", // olive
  "#b0889e", // mauve
];

function formatMonth(monthStr: string): string {
  const [, m] = monthStr.split("-");
  const monthNum = parseInt(m, 10);
  return `${monthNum}月`;
}

export default function MedicationConsumptionChart() {
  const [expanded, setExpanded] = useState(false);
  const [months, setMonths] = useState(6);

  const { data, isLoading } = trpc.medReminders.monthlyConsumption.useQuery(
    { months },
    { enabled: expanded }
  );

  // Extract unique medication names for chart keys
  const { chartData, medNames, colorMap } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], medNames: [] as string[], colorMap: new Map<string, string>() };
    }

    // Collect all unique medication names
    const nameSet = new Set<string>();
    for (const month of data) {
      for (const med of month.medications) {
        nameSet.add(med.name);
      }
    }
    const names = Array.from(nameSet);

    // Assign colors
    const cMap = new Map<string, string>();
    names.forEach((name, i) => {
      cMap.set(name, MED_COLORS[i % MED_COLORS.length]);
    });

    // Build chart data
    const cData = data.map((month) => {
      const row: Record<string, any> = {
        month: formatMonth(month.month),
        rawMonth: month.month,
        total: month.totalCount,
      };
      for (const name of names) {
        const found = month.medications.find((m) => m.name === name);
        row[name] = found ? found.count : 0;
      }
      return row;
    });

    return { chartData: cData, medNames: names, colorMap: cMap };
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-card rounded-2xl shadow-sm border border-border/40 overflow-hidden"
    >
      {/* Header - clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-terracotta/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-terracotta" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">月度用药趋势</p>
            <p className="text-[11px] text-muted-foreground">
              查看近{months}个月的用药消耗变化
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Chart content */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4"
        >
          {/* Month range selector */}
          <div className="flex gap-1.5 mb-3">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`text-xs px-3 py-1 rounded-lg transition-all ${
                  months === m
                    ? "bg-terracotta text-white font-semibold"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {m}个月
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !chartData || chartData.length === 0 || medNames.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无用药数据</p>
              <p className="text-xs mt-1">记录用药后，这里会显示消耗趋势</p>
            </div>
          ) : (
            <>
              <div className="h-[220px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      opacity={0.3}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      formatter={(value: number, name: string) => [
                        `${value} 次`,
                        name,
                      ]}
                    />
                    {medNames.map((name) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        stackId="meds"
                        fill={colorMap.get(name) || MED_COLORS[0]}
                        radius={
                          name === medNames[medNames.length - 1]
                            ? [4, 4, 0, 0]
                            : [0, 0, 0, 0]
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
                {medNames.map((name) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: colorMap.get(name) || MED_COLORS[0],
                      }}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {chartData.length > 1 && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      本月合计：
                      <span className="font-semibold text-foreground">
                        {chartData[chartData.length - 1]?.total ?? 0} 次
                      </span>
                    </span>
                    {chartData.length >= 2 && (() => {
                      const current = chartData[chartData.length - 1]?.total ?? 0;
                      const previous = chartData[chartData.length - 2]?.total ?? 0;
                      if (previous === 0) return null;
                      const change = Math.round(((current - previous) / previous) * 100);
                      return (
                        <span className={change > 0 ? "text-red-500" : change < 0 ? "text-green-600" : ""}>
                          {change > 0 ? "↑" : change < 0 ? "↓" : "→"}{" "}
                          较上月 {Math.abs(change)}%
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
