/**
 * TodayWidget — 今日快速概览卡片
 * 显示今天 vs 昨天的核心指标变化，用箭头和颜色标注改善/恶化/持平
 */
import { useMemo } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import {
  Brain,
  Eye,
  Moon,
  Heart,
  Battery,
  Car,
  HeartPulse,
  Smile,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
} from "lucide-react";

const METRICS = [
  { key: "dizziness", label: "头晕", icon: Brain, invert: true },
  { key: "headache", label: "头痛", icon: Brain, invert: true },
  { key: "sleepQuality", label: "睡眠", icon: Moon, invert: false },
  { key: "anxiety", label: "焦虑", icon: Heart, invert: true },
  { key: "fatigue", label: "疲劳", icon: Battery, invert: true },
  { key: "photosensitivity", label: "畏光", icon: Eye, invert: true },
  { key: "motionSickness", label: "运动敏感", icon: Car, invert: true },
  { key: "palpitations", label: "心慌", icon: HeartPulse, invert: true },
  { key: "mood", label: "心情", icon: Smile, invert: false },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

interface TodayWidgetProps {
  entries: SymptomEntry[];
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Determine change direction.
 * For "invert" metrics (higher = worse): decrease = improved, increase = worsened
 * For normal metrics (higher = better): increase = improved, decrease = worsened
 */
function getChange(
  todayVal: number,
  yesterdayVal: number,
  invert: boolean
): { direction: "up" | "down" | "same"; improved: boolean | null; diff: number } {
  const diff = todayVal - yesterdayVal;
  if (diff === 0) return { direction: "same", improved: null, diff: 0 };
  const direction = diff > 0 ? "up" : "down";
  // For inverted metrics: going down is improvement
  // For normal metrics: going up is improvement
  const improved = invert ? diff < 0 : diff > 0;
  return { direction, improved, diff };
}

export default function TodayWidget({ entries }: TodayWidgetProps) {
  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();

  const todayEntry = useMemo(
    () => entries.find((e) => e.date === todayStr),
    [entries, todayStr]
  );

  const yesterdayEntry = useMemo(
    () => entries.find((e) => e.date === yesterdayStr),
    [entries, yesterdayStr]
  );

  // If no today entry, don't show widget
  if (!todayEntry) return null;

  // Calculate overall score (average of all 9 metrics, normalized)
  const todayAvg = useMemo(() => {
    let sum = 0;
    for (const m of METRICS) {
      const val = (todayEntry as any)[m.key] ?? 0;
      // Normalize: for inverted metrics, 10-val gives "wellness" score
      sum += m.invert ? 10 - val : val;
    }
    return sum / METRICS.length;
  }, [todayEntry]);

  const yesterdayAvg = useMemo(() => {
    if (!yesterdayEntry) return null;
    let sum = 0;
    for (const m of METRICS) {
      const val = (yesterdayEntry as any)[m.key] ?? 0;
      sum += m.invert ? 10 - val : val;
    }
    return sum / METRICS.length;
  }, [yesterdayEntry]);

  const overallChange = yesterdayAvg !== null
    ? getChange(todayAvg, yesterdayAvg, false) // higher wellness = better
    : null;

  // Pick top 4 most notable changes (largest absolute diff)
  const metricChanges = useMemo(() => {
    if (!yesterdayEntry) return [];
    return METRICS.map((m) => {
      const todayVal = (todayEntry as any)[m.key] ?? 0;
      const yesterdayVal = (yesterdayEntry as any)[m.key] ?? 0;
      const change = getChange(todayVal, yesterdayVal, m.invert);
      return { ...m, todayVal, yesterdayVal, change };
    })
      .filter((m) => m.change.diff !== 0)
      .sort((a, b) => Math.abs(b.change.diff) - Math.abs(a.change.diff))
      .slice(0, 4);
  }, [todayEntry, yesterdayEntry]);

  // Wellness level text
  const getWellnessText = (avg: number): string => {
    if (avg >= 8) return "状态很好";
    if (avg >= 6) return "状态不错";
    if (avg >= 4) return "状态一般";
    if (avg >= 2) return "状态较差";
    return "状态不佳";
  };

  const getWellnessColor = (avg: number): string => {
    if (avg >= 7) return "text-sage";
    if (avg >= 4) return "text-chart-4";
    return "text-destructive";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border/30 bg-card p-4 mb-4"
    >
      {/* Header row: overall score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-terracotta" />
          <span className="font-serif text-sm font-bold text-foreground">今日概览</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${getWellnessColor(todayAvg)}`}>
            {todayAvg.toFixed(1)}
          </span>
          <span className={`text-xs ${getWellnessColor(todayAvg)}`}>
            {getWellnessText(todayAvg)}
          </span>
          {overallChange && overallChange.direction !== "same" && (
            <span className={`text-xs flex items-center ${
              overallChange.improved ? "text-sage" : "text-destructive"
            }`}>
              {overallChange.improved ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Metric grid: today's values */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {METRICS.slice(0, 6).map((m) => {
          const Icon = m.icon;
          const val = (todayEntry as any)[m.key] ?? 0;
          // Color based on severity
          const color = m.invert
            ? val <= 3 ? "text-sage" : val <= 6 ? "text-chart-4" : "text-destructive"
            : val >= 7 ? "text-sage" : val >= 4 ? "text-chart-4" : "text-destructive";
          return (
            <div key={m.key} className="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1.5">
              <Icon className={`w-3 h-3 ${color}`} />
              <span className="text-[11px] text-muted-foreground truncate">{m.label}</span>
              <span className={`text-xs font-bold ml-auto ${color}`}>{val}</span>
            </div>
          );
        })}
      </div>

      {/* Yesterday comparison */}
      {yesterdayEntry ? (
        <>
          {metricChanges.length > 0 ? (
            <div className="border-t border-border/20 pt-2.5">
              <p className="text-[10px] text-muted-foreground mb-2">与昨天相比：</p>
              <div className="flex flex-wrap gap-1.5">
                {metricChanges.map((m) => {
                  const Icon = m.icon;
                  const isImproved = m.change.improved;
                  const absDiff = Math.abs(m.change.diff);
                  return (
                    <div
                      key={m.key}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${
                        isImproved
                          ? "border-sage/30 bg-sage/10 text-sage"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{m.label}</span>
                      {isImproved ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>{isImproved ? "↓" : "↑"}{absDiff}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border-t border-border/20 pt-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Minus className="w-3 h-3" />
                <span>与昨天相比无明显变化</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="border-t border-border/20 pt-2.5">
          <p className="text-[10px] text-muted-foreground">
            昨天未记录，无法对比变化
          </p>
        </div>
      )}
    </motion.div>
  );
}
