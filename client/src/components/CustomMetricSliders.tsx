/**
 * Custom Metric Sliders — renders sliders for user-defined symptom metrics.
 */
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { getCustomMetrics } from "@/lib/local-storage";

interface CustomMetricSlidersProps {
  values: Record<number, number>;
  onChange: (metricId: number, value: number) => void;
}

export default function CustomMetricSliders({ values, onChange }: CustomMetricSlidersProps) {
  const metrics = getCustomMetrics();
  if (metrics.length === 0) return null;
  return (
    <div className="space-y-4">
      {metrics.map((metric) => {
        const val = values[metric.id] ?? 5;
        return (
          <motion.div key={metric.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-terracotta" />
                <span className="text-sm font-medium">{metric.name}</span>
                {metric.description && (
                  <span className="text-[10px] text-muted-foreground">({metric.description})</span>
                )}
              </div>
              <span className="text-sm font-bold tabular-nums text-terracotta">{val}</span>
            </div>
            <Slider value={[val]} onValueChange={(v) => onChange(metric.id, v[0])} min={1} max={10} step={1} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{metric.isHighGood ? "差" : "轻"}</span>
              <span>{metric.isHighGood ? "好" : "重"}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
