/**
 * Correlation Heatmap — visual matrix showing trigger-symptom impact
 * Each cell shows the difference in average symptom score when a trigger is present vs absent
 */
import { useMemo } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Grid3X3, Info } from "lucide-react";

interface CorrelationHeatmapProps {
  entries: SymptomEntry[];
}

const SYMPTOM_META: { key: string; label: string; short: string; invert: boolean }[] = [
  { key: "dizziness", label: "头晕", short: "晕", invert: true },
  { key: "headache", label: "头痛", short: "痛", invert: true },
  { key: "sleepQuality", label: "睡眠", short: "眠", invert: false },
  { key: "anxiety", label: "焦虑", short: "虑", invert: true },
  { key: "fatigue", label: "疲劳", short: "劳", invert: true },
  { key: "photosensitivity", label: "畏光", short: "光", invert: true },
  { key: "motionSickness", label: "运动敏感", short: "动", invert: true },
  { key: "palpitations", label: "心慌", short: "慌", invert: true },
  { key: "mood", label: "心情", short: "情", invert: false },
];

interface CellData {
  trigger: string;
  symptomKey: string;
  diff: number;
  impact: "worse" | "better" | "neutral";
  withTrigger: number;
  withoutTrigger: number;
}

function getCellColor(diff: number, impact: "worse" | "better" | "neutral"): string {
  if (impact === "neutral") return "bg-muted/30";
  const absDiff = Math.abs(diff);
  if (impact === "worse") {
    if (absDiff >= 2) return "bg-red-500/30";
    if (absDiff >= 1) return "bg-red-400/20";
    return "bg-red-300/15";
  }
  // better
  if (absDiff >= 2) return "bg-emerald-500/30";
  if (absDiff >= 1) return "bg-emerald-400/20";
  return "bg-emerald-300/15";
}

function getCellTextColor(impact: "worse" | "better" | "neutral"): string {
  if (impact === "worse") return "text-red-600";
  if (impact === "better") return "text-emerald-600";
  return "text-muted-foreground";
}

export default function CorrelationHeatmap({ entries }: CorrelationHeatmapProps) {
  const { triggers, cells } = useMemo(() => {
    if (entries.length < 3) return { triggers: [], cells: [] };

    // Find triggers with at least 2 occurrences
    const triggerCounts: Record<string, number> = {};
    entries.forEach((e) => {
      if (Array.isArray(e.triggers)) {
        e.triggers.forEach((t) => {
          triggerCounts[t] = (triggerCounts[t] || 0) + 1;
        });
      }
    });

    const validTriggers = Object.entries(triggerCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // Limit to top 8 triggers for readability
      .map(([name]) => name);

    if (validTriggers.length === 0) return { triggers: [], cells: [] };

    const cellData: CellData[] = [];
    for (const trigger of validTriggers) {
      const withTrigger = entries.filter((e) =>
        Array.isArray(e.triggers) && e.triggers.includes(trigger)
      );
      const withoutTrigger = entries.filter((e) =>
        !Array.isArray(e.triggers) || !e.triggers.includes(trigger)
      );

      if (withoutTrigger.length === 0) continue;

      for (const sym of SYMPTOM_META) {
        const avgWith = withTrigger.reduce((s, e) => s + (e as any)[sym.key], 0) / withTrigger.length;
        const avgWithout = withoutTrigger.reduce((s, e) => s + (e as any)[sym.key], 0) / withoutTrigger.length;
        const diff = Math.round((avgWith - avgWithout) * 10) / 10;

        let impact: "worse" | "better" | "neutral" = "neutral";
        if (Math.abs(diff) >= 0.5) {
          if (sym.invert) {
            impact = diff > 0 ? "worse" : "better";
          } else {
            impact = diff > 0 ? "better" : "worse";
          }
        }

        cellData.push({
          trigger,
          symptomKey: sym.key,
          diff,
          impact,
          withTrigger: Math.round(avgWith * 10) / 10,
          withoutTrigger: Math.round(avgWithout * 10) / 10,
        });
      }
    }

    return { triggers: validTriggers, cells: cellData };
  }, [entries]);

  if (triggers.length === 0) return null;

  const getCell = (trigger: string, symptomKey: string): CellData | undefined => {
    return cells.find((c) => c.trigger === trigger && c.symptomKey === symptomKey);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-2">
        <Grid3X3 className="w-4 h-4 text-dusty-blue" />
        <h3 className="font-serif font-semibold text-sm">关联热力图</h3>
      </div>

      <div className="flex items-start gap-1.5 mb-4 p-2.5 bg-muted/50 rounded-lg">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          颜色深浅表示诱因对症状的影响程度。
          <span className="text-red-500 font-medium">红色</span>表示加重，
          <span className="text-emerald-600 font-medium">绿色</span>表示改善。
          数值为有/无该诱因时的评分差异。
        </p>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className="text-left py-1.5 px-1 font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[60px]">
                诱因
              </th>
              {SYMPTOM_META.map((sym) => (
                <th
                  key={sym.key}
                  className="py-1.5 px-0.5 font-medium text-muted-foreground text-center min-w-[32px]"
                  title={sym.label}
                >
                  {sym.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triggers.map((trigger, i) => (
              <motion.tr
                key={trigger}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <td className="py-1 px-1 font-medium text-xs sticky left-0 bg-card z-10 truncate max-w-[80px]" title={trigger}>
                  {trigger}
                </td>
                {SYMPTOM_META.map((sym) => {
                  const cell = getCell(trigger, sym.key);
                  if (!cell) return <td key={sym.key} className="py-1 px-0.5" />;
                  return (
                    <td
                      key={sym.key}
                      className={`py-1 px-0.5 text-center rounded ${getCellColor(cell.diff, cell.impact)}`}
                      title={`${trigger} → ${sym.label}: 有诱因${cell.withTrigger} / 无诱因${cell.withoutTrigger} (差${cell.diff > 0 ? "+" : ""}${cell.diff})`}
                    >
                      <span className={`font-medium ${getCellTextColor(cell.impact)}`}>
                        {cell.diff > 0 ? "+" : ""}{cell.diff}
                      </span>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-400/25" />
          <span>加重</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-muted/50" />
          <span>无影响</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-400/25" />
          <span>改善</span>
        </div>
      </div>
    </motion.div>
  );
}
