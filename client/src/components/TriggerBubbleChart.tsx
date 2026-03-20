/**
 * Trigger Bubble Chart — visual bubble/cloud display of trigger frequencies
 * Bubble size represents frequency, color represents negative impact
 */
import { useMemo } from "react";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import { motion } from "framer-motion";
import { Cloud } from "lucide-react";

interface TriggerBubbleChartProps {
  entries: SymptomEntry[];
}

const BUBBLE_COLORS = [
  { bg: "bg-terracotta/20", text: "text-terracotta", border: "border-terracotta/30" },
  { bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/25" },
  { bg: "bg-dusty-blue/20", text: "text-dusty-blue", border: "border-dusty-blue/30" },
  { bg: "bg-sage/20", text: "text-sage", border: "border-sage/30" },
  { bg: "bg-chart-4/15", text: "text-chart-4", border: "border-chart-4/25" },
  { bg: "bg-chart-5/15", text: "text-chart-5", border: "border-chart-5/25" },
];

interface BubbleData {
  trigger: string;
  count: number;
  percentage: number;
  size: "xl" | "lg" | "md" | "sm" | "xs";
}

function getSizeClasses(size: BubbleData["size"]): string {
  switch (size) {
    case "xl": return "text-sm px-5 py-2.5 font-semibold";
    case "lg": return "text-xs px-4 py-2 font-medium";
    case "md": return "text-xs px-3 py-1.5 font-medium";
    case "sm": return "text-[11px] px-2.5 py-1";
    case "xs": return "text-[10px] px-2 py-0.5";
  }
}

export default function TriggerBubbleChart({ entries }: TriggerBubbleChartProps) {
  const bubbles: BubbleData[] = useMemo(() => {
    if (entries.length === 0) return [];

    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      if (Array.isArray(e.triggers)) {
        e.triggers.forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      }
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (sorted.length === 0) return [];

    const maxCount = sorted[0][1];

    return sorted.map(([trigger, count]) => {
      const ratio = count / maxCount;
      let size: BubbleData["size"];
      if (ratio >= 0.8) size = "xl";
      else if (ratio >= 0.6) size = "lg";
      else if (ratio >= 0.4) size = "md";
      else if (ratio >= 0.2) size = "sm";
      else size = "xs";

      return {
        trigger,
        count,
        percentage: Math.round((count / entries.length) * 100),
        size,
      };
    });
  }, [entries]);

  if (bubbles.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <Cloud className="w-4 h-4 text-chart-4" />
        <h3 className="font-serif font-semibold text-sm">诱因词云</h3>
      </div>

      <div className="flex flex-wrap gap-2 justify-center items-center py-2">
        {bubbles.map((b, i) => {
          const colorSet = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
          return (
            <motion.div
              key={b.trigger}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 200 }}
              className={`rounded-full border ${colorSet.bg} ${colorSet.text} ${colorSet.border} ${getSizeClasses(b.size)} cursor-default transition-transform hover:scale-105`}
              title={`${b.trigger}: ${b.count}次 (${b.percentage}%)`}
            >
              {b.trigger}
              <span className="ml-1 opacity-60 text-[9px]">{b.count}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
