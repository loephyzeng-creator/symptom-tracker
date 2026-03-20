/*
 * Design: Warm Healing Journal — Scandinavian + Wabi-sabi
 * Colors: warm cream bg, terracotta accents, sage green, dusty blue
 * Typography: Noto Serif SC (headings), Noto Sans SC (body)
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  X,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SymptomFormProps {
  date: string;
  existingEntry?: SymptomEntry;
  onSave: (entry: Omit<SymptomEntry, "id" | "createdAt">) => void;
  onDateChange: (date: string) => void;
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

const TRIGGER_OPTIONS = [
  "睡眠不足", "压力大", "天气变化", "饮食不当", "运动过量",
  "久坐", "强光刺激", "噪音", "情绪波动", "月经期",
  "未戴眼镜", "坐车", "熬夜", "中午未午睡",
];

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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SymptomForm({ date, existingEntry, onSave, onDateChange }: SymptomFormProps) {
  const [values, setValues] = useState<Record<string, number>>({
    dizziness: 0,
    headache: 0,
    sleepQuality: 5,
    anxiety: 0,
    fatigue: 0,
    photosensitivity: 0,
    motionSickness: 0,
    palpitations: 0,
    mood: 5,
  });
  const [notes, setNotes] = useState("");
  const [medications, setMedications] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

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
      setNotes(existingEntry.notes);
      setMedications(existingEntry.medications);
      setTriggers(existingEntry.triggers);
    } else {
      setValues({
        dizziness: 0, headache: 0, sleepQuality: 5, anxiety: 0,
        fatigue: 0, photosensitivity: 0, motionSickness: 0, palpitations: 0, mood: 5,
      });
      setNotes("");
      setMedications("");
      setTriggers([]);
    }
    setSaved(false);
  }, [existingEntry, date]);

  const handleSave = () => {
    onSave({
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
      medications,
      triggers,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleTrigger = (t: string) => {
    setTriggers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onDateChange(addDays(date, -1))}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="text-center">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {formatDateCN(date)}
          </h2>
          {isToday && (
            <span className="text-xs text-sage font-medium">今天</span>
          )}
          {existingEntry && (
            <span className="text-xs text-terracotta font-medium ml-2">已记录</span>
          )}
        </div>
        <button
          onClick={() => onDateChange(addDays(date, 1))}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          disabled={date >= today}
        >
          <ChevronRight className={`w-5 h-5 ${date >= today ? "text-border" : "text-muted-foreground"}`} />
        </button>
      </div>

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

      {/* Triggers */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
      >
        <h3 className="font-serif font-semibold text-sm mb-3">今日诱因</h3>
        <div className="flex flex-wrap gap-2">
          {TRIGGER_OPTIONS.map((t) => (
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
            </Badge>
          ))}
        </div>
      </motion.div>

      {/* Medications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-card rounded-xl p-4 shadow-sm border border-border/50"
      >
        <h3 className="font-serif font-semibold text-sm mb-3">今日用药</h3>
        <Textarea
          value={medications}
          onChange={(e) => setMedications(e.target.value)}
          placeholder="记录今天服用的药物和剂量..."
          className="bg-muted/50 border-0 resize-none text-sm min-h-[60px]"
        />
      </motion.div>

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
          className={`w-full h-12 text-base font-medium rounded-xl transition-all ${
            saved
              ? "bg-sage hover:bg-sage text-white"
              : "bg-terracotta hover:bg-terracotta/90 text-white"
          }`}
        >
          <Save className="w-4 h-4 mr-2" />
          {saved ? "已保存" : existingEntry ? "更新记录" : "保存记录"}
        </Button>
      </motion.div>
    </div>
  );
}
