/**
 * Headache Attack Frequency & Painkiller Usage Trend Chart
 * Shows weekly aggregation of headache attack levels and painkiller usage days
 */
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Brain, Pill, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

const HEADACHE_LEVELS = [
  { value: 0, label: "无", color: "#d4d4d4" },
  { value: 1, label: "轻微", color: "#f0c674" },
  { value: 2, label: "明显", color: "#e8944a" },
  { value: 3, label: "严重", color: "#c45c5c" },
];

interface HeadachePainkillerChartProps {
  entries: SymptomEntry[];
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day}`;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - startOfYear.getTime();
  const weekNum = Math.ceil((diff / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

interface WeekData {
  weekKey: string;
  weekLabel: string;
  headacheNone: number;
  headacheMild: number;
  headacheModerate: number;
  headacheSevere: number;
  painkillerDays: number;
  totalDays: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-serif text-sm font-semibold mb-2">周起始: {label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value} 天</span>
        </div>
      ))}
    </div>
  );
}

export default function HeadachePainkillerChart({ entries }: HeadachePainkillerChartProps) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const painkillerUsage = trpc.entries.painkillerUsage.useQuery({ date: today });

  const weeklyData = useMemo(() => {
    if (entries.length === 0) return [];

    // Group entries by week
    const weekMap = new Map<string, {
      startDate: string;
      headacheNone: number;
      headacheMild: number;
      headacheModerate: number;
      headacheSevere: number;
      painkillerDays: number;
      totalDays: number;
    }>();

    entries.forEach((e) => {
      const wk = getWeekKey(e.date);
      if (!weekMap.has(wk)) {
        weekMap.set(wk, {
          startDate: e.date,
          headacheNone: 0,
          headacheMild: 0,
          headacheModerate: 0,
          headacheSevere: 0,
          painkillerDays: 0,
          totalDays: 0,
        });
      }
      const w = weekMap.get(wk)!;
      w.totalDays++;
      if (e.date < w.startDate) w.startDate = e.date;

      const level = e.severeHeadache ?? 0;
      if (level === 0) w.headacheNone++;
      else if (level === 1) w.headacheMild++;
      else if (level === 2) w.headacheModerate++;
      else if (level >= 3) w.headacheSevere++;

      if ((e as any).painkillerTaken) w.painkillerDays++;
    });

    // Sort by week key and convert to array
    return Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12) // last 12 weeks
      .map(([weekKey, data]) => ({
        weekKey,
        weekLabel: getWeekLabel(data.startDate),
        ...data,
      }));
  }, [entries]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const last30 = entries.filter((e) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return new Date(e.date + "T00:00:00") >= cutoff;
    });

    const attackDays = last30.filter((e) => (e.severeHeadache ?? 0) > 0).length;
    const severeDays = last30.filter((e) => (e.severeHeadache ?? 0) >= 3).length;
    const painkillerDays = last30.filter((e) => e.painkillerTaken).length;
    const avgLevel = last30.length > 0
      ? Math.round(last30.reduce((sum, e) => sum + (e.severeHeadache ?? 0), 0) / last30.length * 10) / 10
      : 0;

    return { attackDays, severeDays, painkillerDays, totalDays: last30.length, avgLevel };
  }, [entries]);

  if (entries.length === 0) return null;

  const limit = painkillerUsage.data?.limit ?? 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="space-y-4"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-3 border border-border/50 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Brain className="w-4 h-4 text-[#c45c5c]" />
            <span className="text-xs text-muted-foreground">头痛发作</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-serif font-bold text-[#c45c5c]">{summary.attackDays}</span>
            <span className="text-xs text-muted-foreground mb-1">/ {summary.totalDays} 天</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            近30天 · 严重 {summary.severeDays} 天 · 均值 {summary.avgLevel}
          </div>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border/50 shadow-sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Pill className="w-4 h-4 text-[#e8944a]" />
            <span className="text-xs text-muted-foreground">止疼药使用</span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-serif font-bold ${summary.painkillerDays >= limit ? "text-destructive" : summary.painkillerDays >= limit * 0.7 ? "text-[#e8944a]" : "text-[#7a9e7e]"}`}>
              {summary.painkillerDays}
            </span>
            <span className="text-xs text-muted-foreground mb-1">/ {limit} 天上限</span>
          </div>
          {summary.painkillerDays >= limit && (
            <div className="flex items-center gap-1 text-[10px] text-destructive mt-1">
              <AlertTriangle className="w-3 h-3" />
              已达上限，建议咨询医生
            </div>
          )}
          {summary.painkillerDays < limit && (
            <div className="text-[10px] text-muted-foreground mt-1">
              近30天 · 剩余 {limit - summary.painkillerDays} 天额度
            </div>
          )}
        </div>
      </div>

      {/* Headache Attack Level Distribution Chart */}
      <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif font-semibold text-sm">头痛发作分布（按周）</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">最近12周每周头痛发作等级天数分布</p>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3">
          {HEADACHE_LEVELS.slice(1).map((l) => (
            <div key={l.value} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
              <span className="text-[10px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>

        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="headacheMild" name="轻微" stackId="headache" fill="#f0c674" radius={[0, 0, 0, 0]} />
              <Bar dataKey="headacheModerate" name="明显" stackId="headache" fill="#e8944a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="headacheSevere" name="严重" stackId="headache" fill="#c45c5c" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Painkiller Usage Trend */}
      <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Pill className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif font-semibold text-sm">止疼药使用趋势（按周）</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">最近12周每周服用止疼药天数</p>

        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="painkillerDays" name="止疼药" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, index) => {
                  // Color based on weekly painkiller usage relative to limit
                  const weeklyLimit = Math.ceil(limit / 4.3); // ~weekly portion of monthly limit
                  const color = entry.painkillerDays >= weeklyLimit
                    ? "#c45c5c"
                    : entry.painkillerDays > 0
                      ? "#e8944a"
                      : "#d4d4d4";
                  return <Cell key={index} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly average indicator */}
        <div className="text-center text-[10px] text-muted-foreground mt-2">
          建议每周不超过 {Math.ceil(limit / 4.3)} 天 · 月度上限 {limit} 天
        </div>
      </div>
    </motion.div>
  );
}
