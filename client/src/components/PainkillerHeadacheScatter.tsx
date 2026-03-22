/**
 * PainkillerHeadacheScatter — Scatter plot showing correlation between
 * painkiller usage and headache attack levels over the last 30 days.
 */
import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Brain, Pill, TrendingUp } from "lucide-react";

interface Props {
  entries: SymptomEntry[];
}

const HEADACHE_LABELS: Record<number, string> = {
  0: "无",
  1: "轻微",
  2: "明显",
  3: "严重",
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ScatterPoint {
  date: string;
  dateLabel: string;
  headacheLevel: number;
  painkillerTaken: number; // 0 or 1
  color: string;
  size: number;
}

function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as ScatterPoint;
  return (
    <div className="bg-popover text-popover-foreground border border-border/50 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-serif font-semibold text-sm mb-1">{data.dateLabel} ({data.date})</p>
      <div className="flex items-center gap-2">
        <Brain className="w-3 h-3 text-[#c45c5c]" />
        <span className="text-muted-foreground">头痛等级：</span>
        <span className="font-medium">{HEADACHE_LABELS[data.headacheLevel] ?? "无"}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Pill className="w-3 h-3 text-[#e8944a]" />
        <span className="text-muted-foreground">止疼药：</span>
        <span className="font-medium">{data.painkillerTaken ? "已服用" : "未服用"}</span>
      </div>
    </div>
  );
}

export default function PainkillerHeadacheScatter({ entries }: Props) {
  const scatterData = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    return entries
      .filter((e) => new Date(e.date + "T00:00:00") >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => {
        const headache = e.severeHeadache ?? 0;
        const painkiller = (e as any).painkillerTaken ? 1 : 0;
        return {
          date: e.date,
          dateLabel: formatDateLabel(e.date),
          headacheLevel: headache,
          painkillerTaken: painkiller,
          color: painkiller ? "#e8944a" : headache > 0 ? "#c45c5c" : "#a8b5a0",
          size: headache === 0 ? 40 : headache * 60,
        };
      });
  }, [entries]);

  // Correlation analysis
  const correlation = useMemo(() => {
    if (scatterData.length < 3) return null;

    const withPainkiller = scatterData.filter((d) => d.painkillerTaken === 1);
    const withoutPainkiller = scatterData.filter((d) => d.painkillerTaken === 0);

    const avgWithPainkiller =
      withPainkiller.length > 0
        ? withPainkiller.reduce((s, d) => s + d.headacheLevel, 0) / withPainkiller.length
        : 0;
    const avgWithoutPainkiller =
      withoutPainkiller.length > 0
        ? withoutPainkiller.reduce((s, d) => s + d.headacheLevel, 0) / withoutPainkiller.length
        : 0;

    const headacheDaysWithPainkiller = withPainkiller.filter((d) => d.headacheLevel > 0).length;
    const headacheDaysWithoutPainkiller = withoutPainkiller.filter((d) => d.headacheLevel > 0).length;

    return {
      painkillerDays: withPainkiller.length,
      noPainkillerDays: withoutPainkiller.length,
      avgWithPainkiller: Math.round(avgWithPainkiller * 10) / 10,
      avgWithoutPainkiller: Math.round(avgWithoutPainkiller * 10) / 10,
      headacheDaysWithPainkiller,
      headacheDaysWithoutPainkiller,
      headacheRateWithPainkiller:
        withPainkiller.length > 0
          ? Math.round((headacheDaysWithPainkiller / withPainkiller.length) * 100)
          : 0,
      headacheRateWithoutPainkiller:
        withoutPainkiller.length > 0
          ? Math.round((headacheDaysWithoutPainkiller / withoutPainkiller.length) * 100)
          : 0,
    };
  }, [scatterData]);

  if (scatterData.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-serif font-semibold text-sm">止疼药与头痛关联</h3>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">
        近30天散点图 · 横轴为日期，纵轴为头痛等级，橙色点表示服用止疼药
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#e8944a]" />
          <span className="text-[10px] text-muted-foreground">服用止疼药</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#c45c5c]" />
          <span className="text-[10px] text-muted-foreground">头痛未服药</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#a8b5a0]" />
          <span className="text-[10px] text-muted-foreground">无头痛</span>
        </div>
      </div>

      {/* Scatter Chart */}
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis
              dataKey="dateLabel"
              type="category"
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={Math.max(0, Math.floor(scatterData.length / 8) - 1)}
              allowDuplicatedCategory={false}
            />
            <YAxis
              dataKey="headacheLevel"
              type="number"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              domain={[-0.2, 3.2]}
              ticks={[0, 1, 2, 3]}
              tickFormatter={(v: number) => HEADACHE_LABELS[v] ?? ""}
              width={36}
            />
            <ZAxis dataKey="size" range={[30, 180]} />
            <Tooltip content={<ScatterTooltipContent />} />
            <Scatter data={scatterData} shape="circle">
              {scatterData.map((d, i) => (
                <Cell key={i} fill={d.color} fillOpacity={0.8} stroke={d.color} strokeWidth={1} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Correlation Summary */}
      {correlation && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-2.5 border border-orange-200/30 dark:border-orange-800/20">
              <div className="flex items-center gap-1 mb-1">
                <Pill className="w-3 h-3 text-[#e8944a]" />
                <span className="text-[10px] text-muted-foreground">服药日</span>
              </div>
              <div className="text-lg font-serif font-bold text-[#e8944a]">
                {correlation.avgWithPainkiller}
              </div>
              <div className="text-[10px] text-muted-foreground">
                平均头痛等级 · {correlation.painkillerDays}天
              </div>
            </div>
            <div className="bg-sage/10 dark:bg-sage/5 rounded-lg p-2.5 border border-sage/20">
              <div className="flex items-center gap-1 mb-1">
                <Brain className="w-3 h-3 text-sage" />
                <span className="text-[10px] text-muted-foreground">未服药日</span>
              </div>
              <div className="text-lg font-serif font-bold text-sage">
                {correlation.avgWithoutPainkiller}
              </div>
              <div className="text-[10px] text-muted-foreground">
                平均头痛等级 · {correlation.noPainkillerDays}天
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            服药日头痛发生率 {correlation.headacheRateWithPainkiller}% · 未服药日 {correlation.headacheRateWithoutPainkiller}%
          </p>
        </div>
      )}
    </motion.div>
  );
}
