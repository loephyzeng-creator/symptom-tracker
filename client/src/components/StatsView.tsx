/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Recharts-based trend visualization with warm color palette
 * Includes trigger frequency + correlation analysis
 */
import { useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, ReferenceLine,
} from "recharts";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import TriggerAnalysis from "@/components/TriggerAnalysis";
import SymptomSummary from "@/components/SymptomSummary";
import MedicationChart from "@/components/MedicationChart";
import TriggerBubbleChart from "@/components/TriggerBubbleChart";
import AIAnalysis from "@/components/AIAnalysis";
import TriggerDietCorrelation from "@/components/TriggerDietCorrelation";
import TriggerTimelineAnalysis from "@/components/TriggerTimelineAnalysis";
import MedicationAdherence from "@/components/MedicationAdherence";
import HeadachePainkillerChart from "@/components/HeadachePainkillerChart";
import PainkillerHeadacheScatter from "@/components/PainkillerHeadacheScatter";
import { motion } from "framer-motion";
import { Calendar, TrendingDown, TrendingUp, Minus, BarChart3, Flame, Sparkles, Pill } from "lucide-react";
import { getLocalDateStr } from "@shared/timezone";

interface StatsViewProps {
  entries: SymptomEntry[];
}

type StatsTab = "trends" | "triggers" | "adherence" | "ai";

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
  { key: "motionSickness", label: "运动敏感", color: "#5b8fa8", invert: true },
  { key: "palpitations", label: "心慌", color: "#d4845a", invert: true },
  { key: "mood", label: "心情", color: "#8b6bbf", invert: false },
  { key: "socialAnxiety", label: "社交焦虑", color: "#6b8a9b", invert: true },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  // Use raw values from the data point for accurate display
  const rawData = payload[0]?.payload?._raw;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="font-serif text-sm font-semibold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{rawData ? rawData[p.dataKey] : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsView({ entries }: StatsViewProps) {
  const [range, setRange] = useState("30d");
  const [statsTab, setStatsTab] = useState<StatsTab>("trends");
  const [activeSymptoms, setActiveSymptoms] = useState<string[]>([
    "dizziness", "headache", "sleepQuality", "anxiety",
  ]);
  const [showBaseline, setShowBaseline] = useState(true);

  // Pinch-to-zoom state
  const [zoomDomain, setZoomDomain] = useState<{ start: number; end: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ dist: number; start: number; end: number } | null>(null);

  const filteredEntries = useMemo(() => {
    const r = RANGES.find((r) => r.key === range);
    if (!r || r.key === "all") return entries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - r.days);
    const cutoffStr = getLocalDateStr(cutoff);
    return entries.filter((e) => e.date >= cutoffStr);
  }, [entries, range]);

  const chartData = useMemo(() => {
    return filteredEntries.map((e) => {
      // Collect active symptom values to detect overlaps
      const rawValues: Record<string, number> = {
        dizziness: e.dizziness,
        headache: e.headache,
        sleepQuality: e.sleepQuality,
        anxiety: e.anxiety,
        fatigue: e.fatigue,
        photosensitivity: e.photosensitivity,
        motionSickness: e.motionSickness,
        palpitations: e.palpitations,
        mood: e.mood,
        socialAnxiety: (e as any).socialAnxiety ?? 0,
      };

      // Apply micro-offsets to overlapping values so lines don't hide each other
      const activeKeys = activeSymptoms.filter((k) => k in rawValues);
      const valueGroups: Record<number, string[]> = {};
      activeKeys.forEach((k) => {
        const v = rawValues[k];
        if (!valueGroups[v]) valueGroups[v] = [];
        valueGroups[v].push(k);
      });
      const adjusted = { ...rawValues };
      Object.values(valueGroups).forEach((keys) => {
        if (keys.length > 1) {
          // Spread overlapping lines by tiny offsets (±0.08 per line)
          const mid = (keys.length - 1) / 2;
          keys.forEach((k, i) => {
            adjusted[k] = rawValues[k] + (i - mid) * 0.08;
          });
        }
      });

      return {
        date: e.date.slice(5), // MM-DD
        fullDate: e.date,
        // Store raw values for tooltip display
        _raw: rawValues,
        ...adjusted,
      };
    });
  }, [filteredEntries, activeSymptoms]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchStartRef.current = {
        dist,
        start: zoomDomain?.start ?? 0,
        end: zoomDomain?.end ?? (chartData.length - 1),
      };
    }
  }, [zoomDomain, chartData.length]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchStartRef.current.dist;
      const { start: origStart, end: origEnd } = touchStartRef.current;
      const origRange = origEnd - origStart;
      const newRange = Math.max(2, Math.round(origRange / scale));
      const center = Math.round((origStart + origEnd) / 2);
      const newStart = Math.max(0, center - Math.floor(newRange / 2));
      const newEnd = Math.min(chartData.length - 1, newStart + newRange);
      setZoomDomain({ start: newStart, end: newEnd });
    }
  }, [chartData.length]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
  }, []);

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
      {/* Sub-tab: Trends vs Triggers vs AI */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-1">
        <button
          onClick={() => setStatsTab("trends")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            statsTab === "trends"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          趋势
        </button>
        <button
          onClick={() => setStatsTab("triggers")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            statsTab === "triggers"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="w-4 h-4" />
          诱因
        </button>
        <button
          onClick={() => setStatsTab("adherence")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            statsTab === "adherence"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Pill className="w-4 h-4" />
          依从
        </button>
        <button
          onClick={() => setStatsTab("ai")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            statsTab === "ai"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI 分析
        </button>
      </div>

      {statsTab === "ai" ? (
        <AIAnalysis entryCount={entries.length} />
      ) : statsTab === "adherence" ? (
        <MedicationAdherence />
      ) : statsTab === "triggers" ? (
        <>
          <TriggerBubbleChart entries={filteredEntries} />
          <TriggerDietCorrelation entries={filteredEntries} />
           <TriggerTimelineAnalysis entries={filteredEntries} />
           <TriggerAnalysis entries={filteredEntries} />
        </>
      ) : (
        <>
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
            {/* Baseline toggle + zoom reset */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setShowBaseline(!showBaseline)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  showBaseline
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-muted/50 border-border text-muted-foreground"
                }`}
              >
                {showBaseline ? "◉" : "○"} 均值参考线
              </button>
              {zoomDomain && (
                <button
                  onClick={resetZoom}
                  className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                >
                  重置缩放
                </button>
              )}
            </div>
            <div
              className="h-[280px] touch-none"
              ref={chartContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={zoomDomain ? chartData.slice(zoomDomain.start, zoomDomain.end + 1) : chartData}>
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
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                  {/* Baseline reference lines for active symptoms */}
                  {showBaseline && averages && SYMPTOM_CONFIGS.filter((s) => activeSymptoms.includes(s.key)).map((s) => (
                    <ReferenceLine
                      key={`avg-${s.key}`}
                      y={averages[s.key]}
                      stroke={s.color}
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                      label={{
                        value: `· ${s.label}均值 ${averages[s.key]}`,
                        position: "right",
                        fontSize: 9,
                        fill: s.color,
                        opacity: 0.7,
                      }}
                    />
                  ))}
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

          {/* Headache & Painkiller Charts */}
          <HeadachePainkillerChart entries={filteredEntries} rangeDays={RANGES.find((r) => r.key === range)?.days ?? 30} />

          {/* Painkiller-Headache Scatter Plot */}
          <PainkillerHeadacheScatter entries={filteredEntries} />

          {/* Medication Chart */}
          <MedicationChart entries={filteredEntries} />

          {/* Symptom Summary */}
          <SymptomSummary entries={entries} />

          {/* Record count */}
          <div className="text-center text-xs text-muted-foreground py-2">
            共 {entries.length} 条记录 · 最早记录于 {entries[0]?.date}
          </div>
        </>
      )}
    </div>
  );
}
