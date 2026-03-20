/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Trigger frequency ranking + trigger-symptom correlation analysis
 * Colors: warm cream bg, terracotta accents, sage green, dusty blue
 */
import { useMemo, useState } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from "lucide-react";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";

interface TriggerAnalysisProps {
  entries: SymptomEntry[];
}

const SYMPTOM_LABELS: Record<string, string> = {
  dizziness: "头晕",
  headache: "头痛",
  sleepQuality: "睡眠",
  anxiety: "焦虑",
  fatigue: "疲劳",
  photosensitivity: "畏光",
  motionSickness: "运动敏感",
  palpitations: "心慌",
  mood: "心情",
};

const SYMPTOM_COLORS: Record<string, string> = {
  dizziness: "#b87a4b",
  headache: "#c45c5c",
  sleepQuality: "#7a9eb8",
  anxiety: "#9b6b8a",
  fatigue: "#7a9e7e",
  photosensitivity: "#c49a3c",
  motionSickness: "#b87a4b",
  palpitations: "#c45c5c",
  mood: "#7a9e7e",
};

// Symptoms where higher = worse
const INVERTED_SYMPTOMS = new Set([
  "dizziness", "headache", "anxiety", "fatigue",
  "photosensitivity", "motionSickness", "palpitations",
]);

interface TriggerFreq {
  trigger: string;
  count: number;
  percentage: number;
}

interface TriggerCorrelation {
  trigger: string;
  count: number;
  symptoms: {
    key: string;
    label: string;
    withTrigger: number;
    withoutTrigger: number;
    diff: number;
    impact: "worse" | "better" | "neutral";
    color: string;
  }[];
  overallImpact: number; // Weighted negative impact score
}

export default function TriggerAnalysis({ entries }: TriggerAnalysisProps) {
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);

  // Calculate trigger frequency
  const triggerFreqs: TriggerFreq[] = useMemo(() => {
    if (entries.length === 0) return [];
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      e.triggers.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([trigger, count]) => ({
        trigger,
        count,
        percentage: Math.round((count / entries.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  // Calculate trigger-symptom correlations
  const correlations: TriggerCorrelation[] = useMemo(() => {
    if (entries.length < 2) return [];
    const symptomKeys = Object.keys(SYMPTOM_LABELS);

    return triggerFreqs
      .filter((tf) => tf.count >= 2) // Need at least 2 occurrences for meaningful analysis
      .map((tf) => {
        const withTrigger = entries.filter((e) => e.triggers.includes(tf.trigger));
        const withoutTrigger = entries.filter((e) => !e.triggers.includes(tf.trigger));

        if (withoutTrigger.length === 0) {
          return null;
        }

        const symptoms = symptomKeys.map((key) => {
          const avgWith =
            withTrigger.reduce((sum, e) => sum + (e as any)[key], 0) / withTrigger.length;
          const avgWithout =
            withoutTrigger.reduce((sum, e) => sum + (e as any)[key], 0) / withoutTrigger.length;
          const diff = Math.round((avgWith - avgWithout) * 10) / 10;

          const isInverted = INVERTED_SYMPTOMS.has(key);
          let impact: "worse" | "better" | "neutral" = "neutral";
          if (Math.abs(diff) >= 0.5) {
            if (isInverted) {
              impact = diff > 0 ? "worse" : "better";
            } else {
              impact = diff > 0 ? "better" : "worse";
            }
          }

          return {
            key,
            label: SYMPTOM_LABELS[key],
            withTrigger: Math.round(avgWith * 10) / 10,
            withoutTrigger: Math.round(avgWithout * 10) / 10,
            diff,
            impact,
            color: SYMPTOM_COLORS[key],
          };
        });

        // Calculate overall negative impact score
        const overallImpact = symptoms.reduce((sum, s) => {
          if (s.impact === "worse") return sum + Math.abs(s.diff);
          if (s.impact === "better") return sum - Math.abs(s.diff);
          return sum;
        }, 0);

        return {
          trigger: tf.trigger,
          count: tf.count,
          symptoms,
          overallImpact: Math.round(overallImpact * 10) / 10,
        };
      })
      .filter(Boolean) as TriggerCorrelation[];
  }, [entries, triggerFreqs]);

  if (entries.length === 0) {
    return null;
  }

  const hasTriggers = triggerFreqs.length > 0;

  return (
    <div className="space-y-6">
      {/* Trigger Frequency Ranking */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-terracotta" />
          <h3 className="font-serif font-semibold text-sm">诱因频率排行</h3>
          <span className="text-xs text-muted-foreground">
            （共 {entries.length} 条记录）
          </span>
        </div>

        {!hasTriggers ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">暂无诱因记录</p>
            <p className="text-xs text-muted-foreground mt-1">
              在记录页面选择诱因后，这里会显示统计
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {triggerFreqs.map((tf, i) => {
              const maxCount = triggerFreqs[0].count;
              const barWidth = Math.max((tf.count / maxCount) * 100, 8);
              return (
                <motion.div
                  key={tf.trigger}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{tf.trigger}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {tf.count}次 ({tf.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, #b87a4b, ${
                            tf.percentage > 50 ? "#c45c5c" : "#c49a3c"
                          })`,
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Trigger-Symptom Correlation */}
      {correlations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-chart-4" />
            <h3 className="font-serif font-semibold text-sm">诱因-症状关联分析</h3>
          </div>
          <div className="flex items-start gap-1.5 mb-4 p-2.5 bg-muted/50 rounded-lg">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              对比有该诱因和无该诱因时的平均症状评分差异。
              <span className="text-destructive font-medium">红色</span>表示症状加重，
              <span className="text-sage font-medium">绿色</span>表示症状减轻。
              至少需要2次记录才会显示分析。
            </p>
          </div>

          <div className="space-y-2">
            {correlations
              .sort((a, b) => b.overallImpact - a.overallImpact)
              .map((corr, i) => {
                const isExpanded = expandedTrigger === corr.trigger;
                const worseCount = corr.symptoms.filter((s) => s.impact === "worse").length;
                const betterCount = corr.symptoms.filter((s) => s.impact === "better").length;

                return (
                  <motion.div
                    key={corr.trigger}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border border-border/50 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedTrigger(isExpanded ? null : corr.trigger)
                      }
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{corr.trigger}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {corr.count}次
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {worseCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                            {worseCount}项加重
                          </span>
                        )}
                        {betterCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sage/10 text-sage">
                            {betterCount}项改善
                          </span>
                        )}
                        {worseCount === 0 && betterCount === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            影响不明显
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border/50"
                        >
                          <div className="p-3 space-y-2">
                            {/* Header row */}
                            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] text-muted-foreground pb-1 border-b border-border/30">
                              <span>症状</span>
                              <span className="text-right w-12">有诱因</span>
                              <span className="text-right w-12">无诱因</span>
                              <span className="text-right w-14">变化</span>
                            </div>

                            {corr.symptoms.map((s) => (
                              <div
                                key={s.key}
                                className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center"
                              >
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  <span className="text-xs">{s.label}</span>
                                </div>
                                <span className="text-xs font-medium text-right w-12">
                                  {s.withTrigger}
                                </span>
                                <span className="text-xs text-muted-foreground text-right w-12">
                                  {s.withoutTrigger}
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
                                        {s.diff > 0 ? "+" : ""}{s.diff}
                                      </span>
                                    </>
                                  )}
                                  {s.impact === "neutral" && (
                                    <>
                                      <Minus className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {s.diff > 0 ? "+" : ""}{s.diff}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* Summary */}
                            <div className="pt-2 border-t border-border/30">
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                {corr.overallImpact > 1 ? (
                                  <span>
                                    <span className="text-destructive font-medium">「{corr.trigger}」</span>
                                    对症状有明显的负面影响，建议尽量避免。
                                  </span>
                                ) : corr.overallImpact > 0 ? (
                                  <span>
                                    「{corr.trigger}」对症状有轻微的负面影响。
                                  </span>
                                ) : corr.overallImpact < -1 ? (
                                  <span>
                                    <span className="text-sage font-medium">「{corr.trigger}」</span>
                                    出现时症状反而有所改善，可能与其他因素相关。
                                  </span>
                                ) : (
                                  <span>
                                    「{corr.trigger}」对整体症状影响不明显。
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
              })}
          </div>
        </motion.div>
      )}

      {/* Correlation Heatmap */}
      {correlations.length > 0 && (
        <CorrelationHeatmap entries={entries} />
      )}

      {/* Insufficient data notice */}
      {hasTriggers && correlations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-serif font-semibold text-sm text-muted-foreground">
              诱因-症状关联分析
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            需要更多记录数据才能进行关联分析。每个诱因至少需要出现2次，
            且需要有不包含该诱因的记录作为对照。请继续坚持每日记录！
          </p>
        </motion.div>
      )}
    </div>
  );
}
