/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Recharts-based trend visualization with warm color palette
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Calendar, TrendingDown, TrendingUp, Minus, BarChart3 } from "lucide-react";

interface StatsViewProps {
  entries: SymptomEntry[];
}

const RANGES = [
  { key: "7d", label: "7天", days: 7 },
  { key: "14d", label: "14天", days: 14 },
  { key: "30d", label: "30天", days: 30 },
  { key: "90d", label: "90天", days: 90 },
  { key: "all", label: "全部", days: 9999 },
];

const SYMPTOM_CONFIGS = [
  { key: "dizziness", label: "头晕", color: "#b87a4b", invert: true },
  { key: "headache", label: "头痛", color: "#c45c5c", invert: true },
  { key: "sleepQuality", label: "睡眠", color: "#7a9eb8", invert: false },
  { key: "anxiety", label: "焦虑", color: "#9b6b8a", invert: true },
  { key: "fatigue", label: "疲劳", color: "#7a9e7e", invert: true },
  { key: "photosensitivity", label: "畏光", color: "#c49a3c", invert: true },
  { key: "motionSickness", label: "运动敏感", color: "#b87a4b", invert: true },
  { key: "palpitations", label: "心慌", color: "#c45c5c", invert: true },
  { key: "mood", label: "心情", color: "#7a9e7e", invert: false },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="font-serif text-sm font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsView({ entries }: StatsViewProps) {
  const [range, setRange] = useState("30d");
  const [activeSymptoms, setActiveSymptoms] = useState<string[]>([
    "dizziness", "headache", "sleepQuality", "anxiety",
  ]);

  const filteredEntries = useMemo(() => {
    const r = RANGES.find((r) => r.key === range);
    if (!r || r.key === "all") return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - r.days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return entries.filter((e) => e.date >= cutoffStr);
  }, [entries, range]);

  const chartData = useMemo(() => {
    return filteredEntries.map((e) => ({
      date: e.date.slice(5), // MM-DD
      fullDate: e.date,
      dizziness: e.dizziness,
      headache: e.headache,
      sleepQuality: e.sleepQuality,
      anxiety: e.anxiety,
      fatigue: e.fatigue,
      photosensitivity: e.photosensitivity,
      motionSickness: e.motionSickness,
      palpitations: e.palpitations,
      mood: e.mood,
    }));
  }, [filteredEntries]);

  const averages = useMemo(() => {
    if (filteredEntries.length === 0) return null;
    const sums: Record<string, number> = {};
    SYMPTOM_CONFIGS.forEach((s) => (sums[s.key] = 0));
    filteredEntries.forEach((e) => {
      SYMPTOM_CONFIGS.forEach((s) => {
        sums[s.key] += (e as any)[s.key];
      });
    });
    const avgs: Record<string, number> = {};
    SYMPTOM_CONFIGS.forEach((s) => {
      avgs[s.key] = Math.round((sums[s.key] / filteredEntries.length) * 10) / 10;
    });
    return avgs;
  }, [filteredEntries]);

  // Calculate trend (compare first half vs second half)
  const trends = useMemo(() => {
    if (filteredEntries.length < 4) return null;
    const mid = Math.floor(filteredEntries.length / 2);
    const firstHalf = filteredEntries.slice(0, mid);
    const secondHalf = filteredEntries.slice(mid);
    const result: Record<string, "up" | "down" | "flat"> = {};
    SYMPTOM_CONFIGS.forEach((s) => {
      const avg1 = firstHalf.reduce((sum, e) => sum + (e as any)[s.key], 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((sum, e) => sum + (e as any)[s.key], 0) / secondHalf.length;
      const diff = avg2 - avg1;
      if (Math.abs(diff) < 0.5) result[s.key] = "flat";
      else result[s.key] = diff > 0 ? "up" : "down";
    });
    return result;
  }, [filteredEntries]);

  const toggleSymptom = (key: string) => {
    setActiveSymptoms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663299884726/7CnBeGxyBasxbKLjVrJzxx/empty-state-WiuDqierovtEb9Njh8Jbbn.webp"
          alt="空状态"
          className="w-40 h-40 mx-auto mb-4 opacity-80"
        />
        <p className="font-serif text-lg text-muted-foreground">还没有记录</p>
        <p className="text-sm text-muted-foreground mt-1">开始记录后，这里会显示趋势图表</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Summary Cards */}
      {averages && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-3 gap-2"
        >
          {SYMPTOM_CONFIGS.filter((s) => activeSymptoms.includes(s.key)).map((s) => {
            const trend = trends?.[s.key];
            const isGood = s.invert
              ? (trend === "down")
              : (trend === "up");
            const isBad = s.invert
              ? (trend === "up")
              : (trend === "down");
            return (
              <div
                key={s.key}
                className="bg-card rounded-xl p-3 border border-border/50 shadow-sm"
              >
                <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-serif font-bold" style={{ color: s.color }}>
                    {averages[s.key]}
                  </span>
                  {trend && trend !== "flat" && (
                    <span className={`text-xs mb-0.5 ${isGood ? "text-sage" : isBad ? "text-destructive" : ""}`}>
                      {isGood ? <TrendingDown className="w-3 h-3 inline" /> : <TrendingUp className="w-3 h-3 inline" />}
                    </span>
                  )}
                  {trend === "flat" && (
                    <Minus className="w-3 h-3 text-muted-foreground mb-0.5" />
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">平均值</div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Symptom Toggle */}
      <div className="flex flex-wrap gap-2">
        {SYMPTOM_CONFIGS.map((s) => (
          <button
            key={s.key}
            onClick={() => toggleSymptom(s.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              activeSymptoms.includes(s.key)
                ? "text-white border-transparent"
                : "border-border text-muted-foreground bg-transparent hover:bg-muted"
            }`}
            style={
              activeSymptoms.includes(s.key)
                ? { backgroundColor: s.color, borderColor: s.color }
                : {}
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-serif font-semibold text-sm">趋势变化</h3>
          <span className="text-xs text-muted-foreground">（共 {filteredEntries.length} 条记录）</span>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <Tooltip content={<CustomTooltip />} />
              {SYMPTOM_CONFIGS.filter((s) => activeSymptoms.includes(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: s.color }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Area Chart for key symptoms */}
      {activeSymptoms.includes("dizziness") && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
        >
          <h3 className="font-serif font-semibold text-sm mb-4">头晕 + 头痛 趋势</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="dizziness" name="头晕" stroke="#b87a4b" fill="#b87a4b" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="headache" name="头痛" stroke="#c45c5c" fill="#c45c5c" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Record count */}
      <div className="text-center text-xs text-muted-foreground py-2">
        共 {entries.length} 条记录 · 最早记录于 {entries[0]?.date}
      </div>
    </div>
  );
}
