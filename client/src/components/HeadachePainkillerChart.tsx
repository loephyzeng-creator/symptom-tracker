/**
 * Headache Attack Frequency & Painkiller Usage Trend Chart
 * Shows daily headache attack levels and painkiller usage
 */
import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface DayData {
  date: string;
  dateLabel: string;
  headacheLevel: number;
  headacheLevelLabel: string;
  painkillerTaken: boolean;
}

function HeadacheTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as DayData;
  const level = HEADACHE_LEVELS[data.headacheLevel] || HEADACHE_LEVELS[0];
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-serif text-sm font-semibold mb-1">{data.dateLabel}</p>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: level.color }} />
        <span className="text-muted-foreground">头痛等级：</span>
        <span className="font-medium">{level.label}</span>
      </div>
      {data.painkillerTaken && (
        <div className="flex items-center gap-2 mt-1">
          <Pill className="w-2.5 h-2.5 text-[#e8944a]" />
          <span className="text-muted-foreground">已服止疼药</span>
        </div>
      )}
    </div>
  );
}

function PainkillerTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as DayData;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-serif text-sm font-semibold mb-1">{data.dateLabel}</p>
      <div className="flex items-center gap-2">
        <Pill className="w-2.5 h-2.5 text-[#e8944a]" />
        <span className="text-muted-foreground">止疼药：</span>
        <span className="font-medium">{data.painkillerTaken ? "已服用" : "未服用"}</span>
      </div>
      {data.headacheLevel > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HEADACHE_LEVELS[data.headacheLevel]?.color }} />
          <span className="text-muted-foreground">头痛等级：{HEADACHE_LEVELS[data.headacheLevel]?.label}</span>
        </div>
      )}
    </div>
  );
}

export default function HeadachePainkillerChart({ entries }: HeadachePainkillerChartProps) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const painkillerUsage = trpc.entries.painkillerUsage.useQuery({ date: today });

  // Daily data sorted by date, last 30 days
  const dailyData = useMemo(() => {
    if (entries.length === 0) return [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    return entries
      .filter((e) => new Date(e.date + "T00:00:00") >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        date: e.date,
        dateLabel: formatDateLabel(e.date),
        headacheLevel: e.severeHeadache ?? 0,
        headacheLevelLabel: HEADACHE_LEVELS[e.severeHeadache ?? 0]?.label ?? "无",
        painkillerTaken: !!(e as any).painkillerTaken,
      }));
  }, [entries]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const attackDays = dailyData.filter((d) => d.headacheLevel > 0).length;
    const severeDays = dailyData.filter((d) => d.headacheLevel >= 3).length;
    const painkillerDays = dailyData.filter((d) => d.painkillerTaken).length;
    const avgLevel = dailyData.length > 0
      ? Math.round(dailyData.reduce((sum, d) => sum + d.headacheLevel, 0) / dailyData.length * 10) / 10
      : 0;

    return { attackDays, severeDays, painkillerDays, totalDays: dailyData.length, avgLevel };
  }, [dailyData]);

  if (entries.length === 0) return null;

  const limit = painkillerUsage.data?.limit ?? 10;

  // Custom Y axis tick for headache levels
  const headacheLevelTick = (value: number) => {
    const labels: Record<number, string> = { 0: "无", 1: "轻微", 2: "明显", 3: "严重" };
    return labels[value] ?? "";
  };

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
            <span className="text-xs text-muted-foreground mb-1">天</span>
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

      {/* Headache Attack Level by Day */}
      <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif font-semibold text-sm">头痛发作等级（按日）</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">近30天每日头痛发作等级</p>

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
            <BarChart data={dailyData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval={dailyData.length > 15 ? Math.floor(dailyData.length / 8) : 0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                domain={[0, 3]}
                ticks={[0, 1, 2, 3]}
                tickFormatter={headacheLevelTick}
                width={36}
              />
              <Tooltip content={<HeadacheTooltip />} />
              <Bar dataKey="headacheLevel" radius={[3, 3, 0, 0]}>
                {dailyData.map((d, index) => (
                  <Cell
                    key={index}
                    fill={HEADACHE_LEVELS[d.headacheLevel]?.color ?? "#d4d4d4"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Painkiller Usage by Day */}
      <div className="bg-card rounded-xl p-4 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Pill className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif font-semibold text-sm">止疼药使用（按日）</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">近30天每日止疼药服用情况</p>

        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval={dailyData.length > 15 ? Math.floor(dailyData.length / 8) : 0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                domain={[0, 1]}
                ticks={[0, 1]}
                tickFormatter={(v: number) => v === 1 ? "是" : "否"}
                width={24}
              />
              <Tooltip content={<PainkillerTooltip />} />
              <Bar dataKey={(d: DayData) => d.painkillerTaken ? 1 : 0} name="止疼药" radius={[3, 3, 0, 0]}>
                {dailyData.map((d, index) => (
                  <Cell
                    key={index}
                    fill={d.painkillerTaken ? "#e8944a" : "transparent"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly limit indicator */}
        <div className="text-center text-[10px] text-muted-foreground mt-2">
          月度上限 {limit} 天 · 已使用 {summary.painkillerDays} 天
        </div>
      </div>
    </motion.div>
  );
}
