/**
 * Medication Adherence Statistics Component
 * Shows adherence rate, per-medication breakdown, and daily chart
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import {
  BarChart, Calendar, CheckCircle2, Pill, TrendingUp, XCircle
} from "lucide-react";
import { getLocalDateStr } from "@shared/timezone";

const RANGES = [
  { key: "7d", label: "7天", days: 7 },
  { key: "14d", label: "14天", days: 14 },
  { key: "30d", label: "30天", days: 30 },
  { key: "90d", label: "90天", days: 90 },
];

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return {
    startDate: getLocalDateStr(start),
    endDate: getLocalDateStr(end),
  };
}

function getRateColor(rate: number): string {
  if (rate >= 80) return "#7a9e7e"; // sage green - good
  if (rate >= 50) return "#c49a3c"; // amber - moderate
  return "#c45c5c"; // red - poor
}

function getRateLabel(rate: number): string {
  if (rate >= 90) return "优秀";
  if (rate >= 80) return "良好";
  if (rate >= 60) return "一般";
  if (rate >= 40) return "较差";
  return "需改善";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-serif font-semibold mb-1">{label}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="text-muted-foreground">应服: </span>
          <span className="font-medium">{data.expected} 次</span>
        </p>
        <p>
          <span className="text-muted-foreground">已服: </span>
          <span className="font-medium">{data.taken} 次</span>
        </p>
        <p>
          <span className="text-muted-foreground">依从率: </span>
          <span className="font-medium" style={{ color: getRateColor(data.rate) }}>
            {data.rate}%
          </span>
        </p>
      </div>
    </div>
  );
}

export default function MedicationAdherence() {
  const [range, setRange] = useState("30d");

  const { startDate, endDate } = useMemo(() => {
    const r = RANGES.find((r) => r.key === range);
    return getDateRange(r?.days ?? 30);
  }, [range]);

  const { data, isLoading } = trpc.medReminders.adherence.useQuery(
    { startDate, endDate },
    { staleTime: 60_000 }
  );

  const chartData = useMemo(() => {
    if (!data?.dailyData) return [];
    return data.dailyData.map((d) => ({
      ...d,
      date: d.date.slice(5), // MM-DD
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        加载用药依从性数据...
      </div>
    );
  }

  if (!data || data.perMedication.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border/50 text-center">
        <Pill className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">暂无用药提醒数据</p>
        <p className="text-xs text-muted-foreground mt-1">
          设置用药提醒后，这里会显示服药依从性统计
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Range Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        {RANGES.map((r) => (
          <Button
            key={r.key}
            variant={range === r.key ? "default" : "outline"}
            size="sm"
            className={`text-xs rounded-full shrink-0 ${
              range === r.key
                ? "bg-terracotta hover:bg-terracotta/90 text-white border-terracotta"
                : "border-border"
            }`}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Overall Rate Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-5 border border-border/50 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                总体依从率
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-4xl font-serif font-bold"
                style={{ color: getRateColor(data.overallRate) }}
              >
                {data.overallRate}%
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: getRateColor(data.overallRate) }}
              >
                {getRateLabel(data.overallRate)}
              </span>
            </div>
          </div>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(${getRateColor(data.overallRate)} ${data.overallRate}%, var(--muted) ${data.overallRate}%)`,
            }}
          >
            <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
              <Pill className="w-5 h-5 text-terracotta" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Per-Medication Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-xl p-4 border border-border/50 shadow-sm space-y-3"
      >
        <h3 className="font-serif font-semibold text-sm flex items-center gap-2">
          <Pill className="w-4 h-4 text-muted-foreground" />
          各药品依从率
        </h3>
        {data.perMedication.map((med) => (
          <div key={med.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{med.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {med.taken}/{med.expected}
                </span>
                <span
                  className="font-medium text-sm"
                  style={{ color: getRateColor(med.rate) }}
                >
                  {med.rate}%
                </span>
                {med.rate >= 80 ? (
                  <CheckCircle2
                    className="w-4 h-4"
                    style={{ color: getRateColor(med.rate) }}
                  />
                ) : (
                  <XCircle
                    className="w-4 h-4"
                    style={{ color: getRateColor(med.rate) }}
                  />
                )}
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${med.rate}%`,
                  backgroundColor: getRateColor(med.rate),
                }}
              />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Daily Adherence Chart */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
        >
          <h3 className="font-serif font-semibold text-sm mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            每日服药情况
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval={chartData.length > 14 ? Math.floor(chartData.length / 7) : 0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" radius={[3, 3, 0, 0]} maxBarSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getRateColor(entry.rate)}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}
