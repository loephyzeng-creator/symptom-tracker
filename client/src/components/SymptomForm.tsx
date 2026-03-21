/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Colors: warm cream bg, terracotta accents, sage green, dusty blue
 * Typography: Noto Serif SC (headings), Noto Sans SC (body)
 */
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SymptomEntry } from "@/hooks/useSymptomData";
import CustomMetricSliders from "@/components/CustomMetricSliders";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import {
  Brain,
  Eye,
  Moon,
  Heart,
  Battery,
  Car,
  HeartPulse,
  Smile,
  X,
  Save,
  Plus,
  Trash2,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Pill,
} from "lucide-react";

interface SymptomFormProps {
  date: string;
  existingEntry?: SymptomEntry;
  onSave: (entry: Omit<SymptomEntry, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<any>;
  onDateChange: (date: string) => void;
  allTriggers: string[];
  customTriggers: string[];
  onAddTrigger: (trigger: string) => Promise<boolean> | boolean;
  onRemoveTrigger: (trigger: string) => Promise<void> | void;
  onSwitchToMedication?: () => void;
}

const SYMPTOM_FIELDS = [
  { key: "dizziness", label: "头晕脑胀", icon: Brain, color: "text-terracotta", bgColor: "bg-terracotta/10", invert: true },
  { key: "headache", label: "头痛程度", icon: Brain, color: "text-destructive", bgColor: "bg-destructive/10", invert: true },
  { key: "sleepQuality", label: "睡眠质量", icon: Moon, color: "text-dusty-blue", bgColor: "bg-dusty-blue/10", invert: false },
  { key: "anxiety", label: "焦虑程度", icon: Heart, color: "text-chart-5", bgColor: "bg-chart-5/10", invert: true },
  { key: "fatigue", label: "疲劳程度", icon: Battery, color: "text-sage", bgColor: "bg-sage/10", invert: true },
  { key: "photosensitivity", label: "畏光程度", icon: Eye, color: "text-chart-4", bgColor: "bg-chart-4/10", invert: true },
  { key: "motionSickness", label: "运动敏感", icon: Car, color: "text-terracotta", bgColor: "bg-terracotta/10", invert: true },
  { key: "palpitations", label: "心慌程度", icon: HeartPulse, color: "text-destructive", bgColor: "bg-destructive/10", invert: true },
  { key: "mood", label: "整体心情", icon: Smile, color: "text-sage", bgColor: "bg-sage/10", invert: false },
] as const;

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

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
}

function dateStrToDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function dateToDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SymptomForm({
  date, existingEntry, onSave, onDateChange,
  allTriggers, customTriggers, onAddTrigger, onRemoveTrigger,
  onSwitchToMedication,
}: SymptomFormProps) {
  const [values, setValues] = useState<Record<string, number>>({
    dizziness: 0, headache: 0, sleepQuality: 5, anxiety: 0,
    fatigue: 0, photosensitivity: 0, motionSickness: 0, palpitations: 0, mood: 5,
  });
  const [notes, setNotes] = useState("");

  const [triggers, setTriggers] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [headacheAttack, setHeadacheAttack] = useState(0); // 0=无, 1=轻微, 2=明显, 3=严重
  const [painkillerTaken, setPainkillerTaken] = useState(false);
  const [newTrigger, setNewTrigger] = useState("");
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customMetricValues, setCustomMetricValues] = useState<Record<number, number>>({});

  // Painkiller usage check
  const painkillerUsageCheck = trpc.entries.painkillerUsage.useQuery(
    { date },
    { enabled: false } // only fetch on demand
  );

  const selectedDate = useMemo(() => dateStrToDate(date), [date]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = dateToDateStr(today);
  const isToday = date === todayStr;

  // Load custom metric values when entry changes
  const customMetricValuesQuery = trpc.customMetrics.getValues.useQuery(
    { entryId: existingEntry?.id ?? 0 },
    { enabled: !!existingEntry?.id, refetchOnWindowFocus: false }
  );

  const saveCustomMetrics = trpc.customMetrics.saveValues.useMutation();

  useEffect(() => {
    if (existingEntry) {
      setValues({
        dizziness: existingEntry.dizziness,
        headache: existingEntry.headache,
        sleepQuality: existingEntry.sleepQuality,
        anxiety: existingEntry.anxiety,
        fatigue: existingEntry.fatigue,
        photosensitivity: existingEntry.photosensitivity,
        motionSickness: existingEntry.motionSickness,
        palpitations: existingEntry.palpitations,
        mood: existingEntry.mood,
      });
      setNotes(existingEntry.notes ?? "");
      setTriggers(existingEntry.triggers ?? []);
      setHeadacheAttack(existingEntry.severeHeadache ?? 0);
      setPainkillerTaken(existingEntry.painkillerTaken === 1);
    } else {
      setValues({
        dizziness: 0, headache: 0, sleepQuality: 5, anxiety: 0,
        fatigue: 0, photosensitivity: 0, motionSickness: 0, palpitations: 0, mood: 5,
      });
      setNotes("");
      setTriggers([]);
      setHeadacheAttack(0);
      setPainkillerTaken(false);
      setCustomMetricValues({});
    }
    setSaved(false);
  }, [existingEntry, date]);

  // Sync custom metric values from query
  useEffect(() => {
    if (customMetricValuesQuery.data) {
      const vals: Record<number, number> = {};
      for (const v of customMetricValuesQuery.data) {
        vals[v.metricId] = v.value;
      }
      setCustomMetricValues(vals);
    }
  }, [customMetricValuesQuery.data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const savedEntry = await onSave({
        date,
        dizziness: values.dizziness,
        headache: values.headache,
        sleepQuality: values.sleepQuality,
        anxiety: values.anxiety,
        fatigue: values.fatigue,
        photosensitivity: values.photosensitivity,
        motionSickness: values.motionSickness,
        palpitations: values.palpitations,
        mood: values.mood,
        notes,
        medications: [],
        triggers,
        severeHeadache: headacheAttack,
        painkillerTaken: painkillerTaken ? 1 : 0,
      });
      // Save custom metric values if any
      const metricEntries = Object.entries(customMetricValues);
      if (metricEntries.length > 0 && savedEntry && typeof (savedEntry as any).id === "number") {
        await saveCustomMetrics.mutateAsync({
          entryId: (savedEntry as any).id,
          values: metricEntries.map(([metricId, value]) => ({
            metricId: Number(metricId),
            value,
          })),
        });
      }
      // Stock deduction is now handled by confirmTaken/unconfirmTaken
      setSaved(true);
      // Show toast with link to medication tab
      toast.success("记录已保存", {
        description: "别忘了去用药 tab 打卡哦",
        action: onSwitchToMedication
          ? { label: "去打卡", onClick: onSwitchToMedication }
          : undefined,
        duration: 4000,
      });

      // Check painkiller usage warning
      if (painkillerTaken) {
        try {
          const usage = await painkillerUsageCheck.refetch();
          if (usage.data && usage.data.days >= usage.data.limit) {
            toast.warning("止疼药用量提醒", {
              description: `近30天内已服用止疼药 ${usage.data.days} 天，建议不超过 ${usage.data.limit} 天。请咨询医生。`,
              duration: 8000,
            });
          } else if (usage.data && usage.data.days >= 7) {
            toast.info("止疼药用量提示", {
              description: `近30天内已服用止疼药 ${usage.data.days} 天，接近 ${usage.data.limit} 天上限。`,
              duration: 6000,
            });
          }
        } catch {}
      }
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const toggleTrigger = (t: string) => {
    setTriggers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleAddCustomTrigger = async () => {
    const trimmed = newTrigger.trim();
    if (!trimmed) return;
    const success = await onAddTrigger(trimmed);
    if (success) {
      setNewTrigger("");
      setShowAddTrigger(false);
      setTriggers((prev) => [...prev, trimmed]);
    }
  };


  const handleCalendarSelect = (day: Date | undefined) => {
    if (day) {
      onDateChange(dateToDateStr(day));
      setCalendarOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Symptom Sliders */}
      <div className="space-y-4">
        {SYMPTOM_FIELDS.map((field, i) => {
          const Icon = field.icon;
          const val = values[field.key];
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${field.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${field.color}`} />
                  </div>
                  <span className="font-medium text-sm">{field.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-serif font-bold ${getScoreColor(val, field.invert)}`}>
                    {val}
                  </span>
                  <span className={`text-xs ${getScoreColor(val, field.invert)}`}>
                    {getScoreLabel(val, field.invert)}
                  </span>
                </div>
              </div>
              <Slider
                value={[val]}
                onValueChange={([v]) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                max={10}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">0</span>
                <span className="text-[10px] text-muted-foreground">10</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Severe Headache Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">头痛发作</h3>
            <p className="text-[11px] text-muted-foreground">记录今天头痛发作程度</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 0, label: "无", color: "bg-muted text-muted-foreground" },
            { value: 1, label: "轻微", color: "bg-chart-4/15 text-chart-4 border-chart-4/30" },
            { value: 2, label: "明显", color: "bg-terracotta/15 text-terracotta border-terracotta/30" },
            { value: 3, label: "严重", color: "bg-destructive/15 text-destructive border-destructive/30" },
          ].map((level) => (
            <button
              key={level.value}
              onClick={() => setHeadacheAttack(level.value)}
              className={`py-2 px-1 rounded-lg text-xs font-medium transition-all border ${
                headacheAttack === level.value
                  ? `${level.color} ring-2 ring-offset-1 ${
                      level.value === 0 ? "ring-muted-foreground/30" :
                      level.value === 1 ? "ring-chart-4/40" :
                      level.value === 2 ? "ring-terracotta/40" : "ring-destructive/40"
                    }`
                  : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
        {headacheAttack >= 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20"
          >
            <p className="text-xs text-destructive font-medium">
              ⚠️ 严重头痛，如持续不缓解请及时就医
            </p>
          </motion.div>
        )}

        {/* 是否服用止疼药 */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-chart-4/10 flex items-center justify-center">
              <Pill className="w-3.5 h-3.5 text-chart-4" />
            </div>
            <span className="text-sm font-medium">是否服用止疼药</span>
          </div>
          <button
            onClick={() => setPainkillerTaken(!painkillerTaken)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
              painkillerTaken ? "bg-terracotta" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                painkillerTaken ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </motion.div>

      {/* Triggers */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-semibold text-sm">今日诱因</h3>
          <button
            onClick={() => setShowAddTrigger(!showAddTrigger)}
            className="text-xs text-terracotta hover:text-terracotta/80 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            自定义
          </button>
        </div>

        {showAddTrigger && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex gap-2">
              <Input
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                placeholder="输入新的诱因..."
                className="text-sm bg-muted/50 border-0 h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTrigger();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleAddCustomTrigger}
                className="bg-terracotta hover:bg-terracotta/90 text-white h-9 px-3 shrink-0"
                disabled={!newTrigger.trim()}
              >
                添加
              </Button>
            </div>
          </motion.div>
        )}

        <div className="flex flex-wrap gap-2">
          {allTriggers.map((t) => {
            const isCustom = customTriggers.includes(t);
            return (
              <Badge
                key={t}
                variant={triggers.includes(t) ? "default" : "outline"}
                className={`cursor-pointer transition-all text-xs ${
                  triggers.includes(t)
                    ? "bg-terracotta text-white hover:bg-terracotta/90 border-terracotta"
                    : "hover:bg-muted border-border"
                }`}
                onClick={() => toggleTrigger(t)}
              >
                {t}
                {triggers.includes(t) && <X className="w-3 h-3 ml-1" />}
                {isCustom && !triggers.includes(t) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTrigger(t);
                      setTriggers((prev) => prev.filter((x) => x !== t));
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      </motion.div>


      {/* Custom Metric Sliders */}
      <CustomMetricSliders
        values={customMetricValues}
        onChange={(metricId, value) =>
          setCustomMetricValues((prev) => ({ ...prev, [metricId]: value }))
        }
      />

      {/* Notes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
      >
        <h3 className="font-serif font-semibold text-sm mb-3">备注</h3>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="记录今天的感受、特殊情况..."
          className="bg-muted/50 border-0 resize-none text-sm min-h-[80px]"
        />
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`w-full h-12 text-base font-medium rounded-xl transition-all ${
            saved
              ? "bg-sage hover:bg-sage text-white"
              : "bg-terracotta hover:bg-terracotta/90 text-white"
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? "保存中..." : saved ? "已保存" : existingEntry ? "更新记录" : "保存记录"}
        </Button>
      </motion.div>
    </div>
  );
}
