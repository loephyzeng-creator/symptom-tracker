/**
 * Custom Metric Sliders — renders sliders for user-defined symptom metrics in the record form.
 * Values are saved separately after the main entry is saved.
 */
import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { Activity, Loader2 } from "lucide-react";

interface CustomMetricSlidersProps {
  /** Current custom metric values keyed by metricId */
  values: Record<number, number>;
  /** Callback when a metric value changes */
  onChange: (metricId: number, value: number) => void;
}

export default function CustomMetricSliders({ values, onChange }: CustomMetricSlidersProps) {
  const metricsQuery = trpc.customMetrics.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const metrics = metricsQuery.data ?? [];

  if (metricsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (metrics.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
          <Activity className="w-4 h-4 text-terracotta" />
        </div>
        <h3 className="font-serif font-semibold text-sm">自定义指标</h3>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const val = values[metric.id] ?? 0;
          const isHighGood = metric.isHighGood === 1;

          // Color based on value and direction
          let color = "text-sage";
          if (isHighGood) {
            if (val <= 3) color = "text-terracotta";
            else if (val <= 6) color = "text-amber-500";
            else color = "text-sage";
          } else {
            if (val <= 3) color = "text-sage";
            else if (val <= 6) color = "text-amber-500";
            else color = "text-terracotta";
          }

          return (
            <div key={metric.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{metric.name}</span>
                  {metric.description && (
                    <span className="text-[10px] text-muted-foreground">
                      ({metric.description})
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold tabular-nums ${color}`}>
                  {val}
                </span>
              </div>
              <Slider
                value={[val]}
                onValueChange={([v]) => onChange(metric.id, v)}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>{isHighGood ? "很差" : "无"}</span>
                <span>{isHighGood ? "很好" : "严重"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
