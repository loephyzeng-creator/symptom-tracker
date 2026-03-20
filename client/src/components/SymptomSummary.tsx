/**
 * Symptom Summary — auto-generated weekly/monthly text summary
 * Displays trend descriptions, averages, key findings
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { formatMedications } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { FileText, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface SymptomSummaryProps {
  entries: SymptomEntry[];
}

type SummaryPeriod = "week" | "month";

const SYMPTOM_META: Record<string, { label: string; invert: boolean }> = {
  dizziness: { label: "头晕", invert: true },
  headache: { label: "头痛", invert: true },
  sleepQuality: { label: "睡眠质量", invert: false },
  anxiety: { label: "焦虑", invert: true },
  fatigue: { label: "疲劳", invert: true },
  photosensitivity: { label: "畏光", invert: true },
  motionSickness: { label: "运动敏感", invert: true },
  palpitations: { label: "心慌", invert: true },
  mood: { label: "心情", invert: false },
};

const SYMPTOM_KEYS = Object.keys(SYMPTOM_META);

function getEntriesInPeriod(entries: SymptomEntry[], period: SummaryPeriod): SymptomEntry[] {
  const now = new Date();
  const cutoff = new Date();
  if (period === "week") {
    cutoff.setDate(now.getDate() - 7);
  } else {
    cutoff.setDate(now.getDate() - 30);
  }
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= cutoffStr);
}

function computeAverages(entries: SymptomEntry[]): Record<string, number> {
  const sums: Record<string, number> = {};
  SYMPTOM_KEYS.forEach((k) => (sums[k] = 0));
  entries.forEach((e) => {
    SYMPTOM_KEYS.forEach((k) => {
      sums[k] += (e as any)[k];
    });
  });
  const avgs: Record<string, number> = {};
  SYMPTOM_KEYS.forEach((k) => {
    avgs[k] = Math.round((sums[k] / entries.length) * 10) / 10;
  });
  return avgs;
}

function computeTrends(
  entries: SymptomEntry[]
): Record<string, { direction: "up" | "down" | "flat"; diff: number }> {
  if (entries.length < 3) {
    const result: Record<string, { direction: "up" | "down" | "flat"; diff: number }> = {};
    SYMPTOM_KEYS.forEach((k) => (result[k] = { direction: "flat", diff: 0 }));
    return result;
  }
  const mid = Math.floor(entries.length / 2);
  const firstHalf = entries.slice(0, mid);
  const secondHalf = entries.slice(mid);
  const result: Record<string, { direction: "up" | "down" | "flat"; diff: number }> = {};
  SYMPTOM_KEYS.forEach((k) => {
    const avg1 = firstHalf.reduce((sum, e) => sum + (e as any)[k], 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((sum, e) => sum + (e as any)[k], 0) / secondHalf.length;
    const diff = Math.round((avg2 - avg1) * 10) / 10;
    if (Math.abs(diff) < 0.5) result[k] = { direction: "flat", diff };
    else result[k] = { direction: diff > 0 ? "up" : "down", diff };
  });
  return result;
}

function getTopTriggers(entries: SymptomEntry[], topN = 3): { trigger: string; count: number }[] {
  const triggerMap = new Map<string, number>();
  entries.forEach((e) => {
    if (Array.isArray(e.triggers)) {
      e.triggers.forEach((t: string) => {
        triggerMap.set(t, (triggerMap.get(t) ?? 0) + 1);
      });
    }
  });
  return Array.from(triggerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([trigger, count]) => ({ trigger, count }));
}

function getTopMedications(entries: SymptomEntry[], topN = 3): { name: string; count: number }[] {
  const medMap = new Map<string, number>();
  entries.forEach((e) => {
    const meds = e.medications;
    if (Array.isArray(meds)) {
      meds.forEach((m: any) => {
        if (m.name?.trim()) {
          const key = m.name.trim();
          medMap.set(key, (medMap.get(key) ?? 0) + 1);
        }
      });
    }
  });
  return Array.from(medMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, count]) => ({ name, count }));
}

function getSevereHeadacheDays(entries: SymptomEntry[]): number {
  return entries.filter((e) => e.severeHeadache === 1).length;
}

export function generateSummaryText(
  entries: SymptomEntry[],
  period: SummaryPeriod
): string {
  const periodLabel = period === "week" ? "本周" : "本月";
  const periodEntries = getEntriesInPeriod(entries, period);

  if (periodEntries.length === 0) {
    return `${periodLabel}暂无记录数据，无法生成摘要。`;
  }

  const avgs = computeAverages(periodEntries);
  const trends = computeTrends(periodEntries);
  const topTriggers = getTopTriggers(periodEntries);
  const topMeds = getTopMedications(periodEntries);
  const severeCount = getSevereHeadacheDays(periodEntries);

  const lines: string[] = [];

  // Header
  const dateRange = `${periodEntries[0].date} ~ ${periodEntries[periodEntries.length - 1].date}`;
  lines.push(`【${periodLabel}症状摘要】${dateRange}（共${periodEntries.length}天记录）`);
  lines.push("");

  // Key metrics
  lines.push("▎ 各项指标平均值");
  const metricLines: string[] = [];
  SYMPTOM_KEYS.forEach((k) => {
    const meta = SYMPTOM_META[k];
    const trend = trends[k];
    let arrow = "→";
    let trendText = "持平";
    if (trend.direction === "up") {
      arrow = meta.invert ? "↑" : "↑";
      trendText = `${meta.invert ? "加重" : "改善"} ${Math.abs(trend.diff)}`;
    } else if (trend.direction === "down") {
      arrow = "↓";
      trendText = `${meta.invert ? "改善" : "下降"} ${Math.abs(trend.diff)}`;
    }
    metricLines.push(`  ${meta.label}：${avgs[k]}/10 ${arrow}${trendText}`);
  });
  lines.push(...metricLines);
  lines.push("");

  // Severe headache
  if (severeCount > 0) {
    lines.push(`⚠ ${periodLabel}发生剧烈头痛 ${severeCount} 天`);
    lines.push("");
  }

  // Key findings
  lines.push("▎ 关键发现");
  const improving = SYMPTOM_KEYS.filter((k) => {
    const meta = SYMPTOM_META[k];
    const trend = trends[k];
    return (meta.invert && trend.direction === "down") || (!meta.invert && trend.direction === "up");
  }).map((k) => SYMPTOM_META[k].label);

  const worsening = SYMPTOM_KEYS.filter((k) => {
    const meta = SYMPTOM_META[k];
    const trend = trends[k];
    return (meta.invert && trend.direction === "up") || (!meta.invert && trend.direction === "down");
  }).map((k) => SYMPTOM_META[k].label);

  if (improving.length > 0) {
    lines.push(`  ✓ 改善中：${improving.join("、")}`);
  }
  if (worsening.length > 0) {
    lines.push(`  ✗ 需关注：${worsening.join("、")}`);
  }
  if (improving.length === 0 && worsening.length === 0) {
    lines.push("  整体趋势平稳，各项指标无明显变化。");
  }
  lines.push("");

  // Top triggers
  if (topTriggers.length > 0) {
    lines.push("▎ 常见诱因");
    topTriggers.forEach((t) => {
      lines.push(`  · ${t.trigger}（${t.count}次）`);
    });
    lines.push("");
  }

  // Top medications
  if (topMeds.length > 0) {
    lines.push("▎ 用药记录");
    topMeds.forEach((m) => {
      lines.push(`  · ${m.name}（${m.count}天使用）`);
    });
    lines.push("");
  }

  // Overall assessment
  const overallBad = (avgs.dizziness + avgs.headache + avgs.anxiety + avgs.fatigue) / 4;
  const overallGood = (avgs.sleepQuality + avgs.mood) / 2;
  lines.push("▎ 综合评估");
  if (overallBad <= 3 && overallGood >= 6) {
    lines.push(`  ${periodLabel}整体状态良好，主要症状控制在较低水平，睡眠和心情状态不错。`);
  } else if (overallBad >= 6) {
    lines.push(`  ${periodLabel}症状较为明显，建议关注休息和用药情况，必要时咨询医生。`);
  } else {
    lines.push(`  ${periodLabel}状态一般，部分指标有波动，建议继续记录观察趋势变化。`);
  }

  return lines.join("\n");
}

export default function SymptomSummary({ entries }: SymptomSummaryProps) {
  const [period, setPeriod] = useState<SummaryPeriod>("week");
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const summaryText = useMemo(() => generateSummaryText(entries, period), [entries, period]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      toast.success("摘要已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-sage" />
          </div>
          <h3 className="font-serif font-semibold text-sm">趋势摘要</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Period toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={period === "week" ? "default" : "outline"}
              size="sm"
              className={`text-xs rounded-full ${
                period === "week"
                  ? "bg-sage hover:bg-sage/90 text-white border-sage"
                  : "border-border"
              }`}
              onClick={() => setPeriod("week")}
            >
              本周
            </Button>
            <Button
              variant={period === "month" ? "default" : "outline"}
              size="sm"
              className={`text-xs rounded-full ${
                period === "month"
                  ? "bg-sage hover:bg-sage/90 text-white border-sage"
                  : "border-border"
              }`}
              onClick={() => setPeriod("month")}
            >
              本月
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 mr-1 text-sage" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1" />
              )}
              {copied ? "已复制" : "复制"}
            </Button>
          </div>

          {/* Summary text */}
          <div className="bg-muted/30 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line text-foreground/90 font-mono">
            {summaryText}
          </div>
        </div>
      )}
    </motion.div>
  );
}
