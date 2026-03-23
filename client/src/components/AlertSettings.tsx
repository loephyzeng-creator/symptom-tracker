/**
 * AlertSettings — 异常预警规则管理（localStorage 版本）
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { getAlertRules, createAlertRule, deleteAlertRule } from "@/lib/local-storage";

const METRIC_OPTIONS = [
  { value: "headacheIntensity", label: "头痛强度" },
  { value: "nausea", label: "恶心程度" },
  { value: "fatigue", label: "疲劳程度" },
  { value: "mood", label: "情绪状态" },
  { value: "sleep", label: "睡眠质量" },
  { value: "stress", label: "压力水平" },
  { value: "appetite", label: "食欲状况" },
  { value: "concentration", label: "专注程度" },
];

export default function AlertSettings() {
  const [rules, setRules] = useState(() => getAlertRules());
  const [showAdd, setShowAdd] = useState(false);
  const [metric, setMetric] = useState("headacheIntensity");
  const [operator, setOperator] = useState<"gte" | "lte">("gte");
  const [threshold, setThreshold] = useState(7);

  const refresh = () => setRules(getAlertRules());

  const handleAdd = () => {
    createAlertRule({ symptomKey: metric, operator, threshold, isActive: 1 });
    refresh();
    setShowAdd(false);
    toast.success("预警规则已添加");
  };

  const handleDelete = (id: number) => {
    deleteAlertRule(id);
    refresh();
    toast.success("预警规则已删除");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-4 border border-border/50 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-terracotta" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">异常预警规则</h3>
            <p className="text-[10px] text-muted-foreground">当指标超过阈值时显示提醒</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="text-xs text-terracotta hover:text-terracotta/80 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />添加
        </button>
      </div>
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="w-full text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5">
              {METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={operator} onChange={(e) => setOperator(e.target.value as "gte" | "lte")} className="text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5">
                <option value="gte">≥ 大于等于</option>
                <option value="lte">≤ 小于等于</option>
              </select>
              <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={1} max={10} className="flex-1 text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm" className="bg-terracotta hover:bg-terracotta/90 text-white rounded-lg text-xs"><Check className="w-3 h-3 mr-1" />保存</Button>
              <Button onClick={() => setShowAdd(false)} variant="outline" size="sm" className="rounded-lg text-xs">取消</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-2">
        {rules.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">暂无预警规则</p>
        ) : (
          rules.map((rule) => {
            const metricLabel = METRIC_OPTIONS.find((o) => o.value === rule.symptomKey)?.label ?? rule.symptomKey;
            const opLabel = rule.operator === "gte" ? "≥" : "≤";
            return (
              <div key={rule.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40">
                <Bell className="w-3.5 h-3.5 text-terracotta shrink-0" />
                <span className="text-xs flex-1">{metricLabel} {opLabel} {rule.threshold}</span>
                <button onClick={() => handleDelete(rule.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
