/**
 * QuickRecord — 快捷记录模式
 * 只显示用户选择的2-3个核心指标，快速保存
 * 其他指标使用默认值（0或5）
 */
import { useState, useEffect, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
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
  Save,
  Loader2,
  Zap,
  Settings2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const ALL_METRICS = [
  { key: "dizziness", label: "头晕脑胀", icon: Brain, color: "text-terracotta", default: 0, invert: true },
  { key: "headache", label: "头痛程度", icon: Brain, color: "text-destructive", default: 0, invert: true },
  { key: "sleepQuality", label: "睡眠质量", icon: Moon, color: "text-dusty-blue", default: 5, invert: false },
  { key: "anxiety", label: "焦虑程度", icon: Heart, color: "text-chart-5", default: 0, invert: true },
  { key: "fatigue", label: "疲劳程度", icon: Battery, color: "text-sage", default: 0, invert: true },
  { key: "photosensitivity", label: "畏光程度", icon: Eye, color: "text-chart-4", default: 0, invert: true },
  { key: "motionSickness", label: "运动敏感", icon: Car, color: "text-terracotta", default: 0, invert: true },
  { key: "palpitations", label: "心慌程度", icon: HeartPulse, color: "text-destructive", default: 0, invert: true },
  { key: "mood", label: "整体心情", icon: Smile, color: "text-sage", default: 5, invert: false },
] as const;

type MetricKey = (typeof ALL_METRICS)[number]["key"];

const STORAGE_KEY = "quick-record-metrics";
const DEFAULT_QUICK_METRICS: MetricKey[] = ["dizziness", "headache", "sleepQuality"];

function getScoreLabel(value: number, invert: boolean): string {
  if (invert) {
    if (value <= 2) return "轻微";
    if (value <= 5) return "中等";
    if (value <= 7) return "较重";
    return "严重";
  } else {
    if (value <= 2) return "很差";
    if (value <= 5) return "一般";
    if (value <= 7) return "较好";
    return "很好";
  }
}

function getScoreColor(value: number, invert: boolean): string {
  if (invert) {
    if (value <= 2) return "text-sage";
    if (value <= 5) return "text-chart-4";
    if (value <= 7) return "text-terracotta";
    return "text-destructive";
  } else {
    if (value <= 2) return "text-destructive";
    if (value <= 5) return "text-chart-4";
    if (value <= 7) return "text-sage";
    return "text-sage";
  }
}

interface QuickRecordProps {
  date: string;
  existingEntry?: SymptomEntry;
  onSave: (entry: Omit<SymptomEntry, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<any>;
}

export default function QuickRecord({ date, existingEntry, onSave }: QuickRecordProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      }
    } catch {}
    return DEFAULT_QUICK_METRICS;
  });

  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize values from existing entry or defaults
  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const m of ALL_METRICS) {
      if (existingEntry) {
        initial[m.key] = (existingEntry as any)[m.key] ?? m.default;
      } else {
        initial[m.key] = m.default;
      }
    }
    setValues(initial);
    setSaved(false);
  }, [date, existingEntry]);

  const quickMetrics = useMemo(
    () => ALL_METRICS.filter((m) => selectedMetrics.includes(m.key)),
    [selectedMetrics]
  );

  const handleToggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      let next: MetricKey[];
      if (prev.includes(key)) {
        if (prev.length <= 2) {
          toast.error("至少需要选择 2 个指标");
          return prev;
        }
        next = prev.filter((k) => k !== key);
      } else {
        if (prev.length >= 5) {
          toast.error("最多选择 5 个指标");
          return prev;
        }
        next = [...prev, key];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entry: any = {
        date,
        medications: existingEntry?.medications ?? [],
        triggers: existingEntry?.triggers ?? [],
        severeHeadache: existingEntry?.severeHeadache ?? 0,
        notes: existingEntry?.notes ?? null,
      };
      // Fill all metrics: use quick-edited values for selected, defaults/existing for others
      for (const m of ALL_METRICS) {
        entry[m.key] = values[m.key] ?? m.default;
      }
      await onSave(entry);
      setSaved(true);
      toast.success("快捷记录已保存");
    } catch (err) {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-terracotta" />
          <h3 className="font-serif text-sm font-bold text-foreground">
            快捷记录
          </h3>
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {isToday ? "今天" : date}
          </span>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`text-xs flex items-center gap-1 transition-colors ${
            showConfig ? "text-terracotta" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>自定义</span>
        </button>
      </div>

      {/* Config panel */}
      {showConfig && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="rounded-xl border border-border/40 bg-card p-3"
        >
          <p className="text-[11px] text-muted-foreground mb-2">
            选择 2-5 个核心指标用于快捷记录：
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_METRICS.map((m) => {
              const Icon = m.icon;
              const isSelected = selectedMetrics.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => handleToggleMetric(m.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                    isSelected
                      ? "border-terracotta/40 bg-terracotta/10 text-terracotta font-medium"
                      : "border-border/40 bg-background/60 text-muted-foreground hover:border-border"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {m.label}
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quick sliders */}
      <div className="space-y-3">
        {quickMetrics.map((metric) => {
          const Icon = metric.icon;
          const val = values[metric.key] ?? metric.default;
          return (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border/30 bg-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`${metric.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {metric.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xl font-bold ${getScoreColor(val, metric.invert)}`}>
                    {val}
                  </span>
                  <span className={`text-xs ${getScoreColor(val, metric.invert)}`}>
                    {getScoreLabel(val, metric.invert)}
                  </span>
                </div>
              </div>
              <Slider
                value={[val]}
                min={0}
                max={10}
                step={1}
                onValueChange={([v]) =>
                  setValues((prev) => ({ ...prev, [metric.key]: v }))
                }
                className="mt-1"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">0</span>
                <span className="text-[10px] text-muted-foreground">10</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className={`w-full h-12 rounded-xl text-base font-medium transition-all ${
          saved
            ? "bg-sage hover:bg-sage/90 text-white"
            : "bg-terracotta hover:bg-terracotta/90 text-white"
        }`}
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            保存中...
          </>
        ) : saved ? (
          <>
            <Check className="w-5 h-5 mr-2" />
            已保存
          </>
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            快捷保存
          </>
        )}
      </Button>

      {/* Info note */}
      <p className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
        未选择的指标将使用{existingEntry ? "已有记录值" : "默认值"}。
        切换到完整模式可编辑全部 9 项指标。
      </p>
    </div>
  );
}
