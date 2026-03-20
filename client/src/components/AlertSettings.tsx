import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  Plus,
  Trash2,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const SYMPTOM_OPTIONS = [
  { key: "dizziness", label: "头晕脑胀" },
  { key: "headache", label: "头痛程度" },
  { key: "sleepQuality", label: "睡眠质量" },
  { key: "anxiety", label: "焦虑程度" },
  { key: "fatigue", label: "疲劳程度" },
  { key: "photosensitivity", label: "畏光程度" },
  { key: "motionSickness", label: "运动敏感" },
  { key: "palpitations", label: "心慌程度" },
  { key: "mood", label: "整体心情" },
];

export default function AlertSettings() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newRule, setNewRule] = useState({
    metricKey: "dizziness",
    threshold: 7,
    consecutiveDays: 3,
    direction: "above" as "above" | "below",
  });

  const utils = trpc.useUtils();
  const { data: rules = [], isLoading: rulesLoading } =
    trpc.alerts.listRules.useQuery(undefined);
  const { data: history = [], isLoading: historyLoading } =
    trpc.alerts.history.useQuery(undefined);
  const { data: unreadCount = 0 } =
    trpc.alerts.unreadCount.useQuery(undefined);

  const createMutation = trpc.alerts.createRule.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
      setShowAddForm(false);
      setNewRule({
        metricKey: "dizziness",
        threshold: 7,
        consecutiveDays: 3,
        direction: "above",
      });
      toast.success("预警规则已添加");
    },
    onError: () => toast.error("添加失败，请重试"),
  });

  const updateMutation = trpc.alerts.updateRule.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
    },
  });

  const deleteMutation = trpc.alerts.deleteRule.useMutation({
    onSuccess: () => {
      utils.alerts.listRules.invalidate();
      toast.success("预警规则已删除");
    },
  });

  const markReadMutation = trpc.alerts.markRead.useMutation({
    onSuccess: () => {
      utils.alerts.history.invalidate();
      utils.alerts.unreadCount.invalidate();
    },
  });

  const getLabel = (key: string) =>
    SYMPTOM_OPTIONS.find((s) => s.key === key)?.label ?? key;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-terracotta" />
          <h3 className="font-serif text-sm font-bold text-foreground">
            症状预警
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 text-xs gap-1"
        >
          <Plus className="w-3 h-3" />
          添加规则
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        当某项指标连续多天超过设定阈值时，自动推送预警提醒。
      </p>

      {/* Add Rule Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 space-y-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                {/* Metric selector */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    监控指标
                  </label>
                  <Select
                    value={newRule.metricKey}
                    onValueChange={(v) =>
                      setNewRule((r) => ({ ...r, metricKey: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMPTOM_OPTIONS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Direction */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    预警方向
                  </label>
                  <Select
                    value={newRule.direction}
                    onValueChange={(v: "above" | "below") =>
                      setNewRule((r) => ({ ...r, direction: v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">高于阈值</SelectItem>
                      <SelectItem value="below">低于阈值</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Threshold slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">
                    阈值：{newRule.threshold} 分
                  </label>
                </div>
                <Slider
                  value={[newRule.threshold]}
                  onValueChange={([v]) =>
                    setNewRule((r) => ({ ...r, threshold: v }))
                  }
                  min={0}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Consecutive days */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">
                    连续天数：{newRule.consecutiveDays} 天
                  </label>
                </div>
                <Slider
                  value={[newRule.consecutiveDays]}
                  onValueChange={([v]) =>
                    setNewRule((r) => ({ ...r, consecutiveDays: v }))
                  }
                  min={1}
                  max={14}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Preview */}
              <div className="bg-background rounded-lg p-3 text-xs text-muted-foreground">
                当「{getLabel(newRule.metricKey)}」连续{" "}
                {newRule.consecutiveDays} 天
                {newRule.direction === "above" ? " ≥ " : " ≤ "}
                {newRule.threshold} 分时触发预警
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="h-7 text-xs"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate(newRule)}
                  disabled={createMutation.isPending}
                  className="h-7 text-xs bg-terracotta hover:bg-terracotta/90 text-white"
                >
                  {createMutation.isPending ? "添加中..." : "添加规则"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Rules */}
      {rulesLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          加载中...
        </p>
      ) : rules.length === 0 ? (
        <Card className="p-6 text-center">
          <BellOff className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            暂无预警规则，点击「添加规则」开始设置
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className={`p-3 transition-opacity ${
                rule.enabled ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {getLabel(rule.metricKey)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {rule.direction === "above" ? "≥" : "≤"}{" "}
                      {rule.threshold} 分 × {rule.consecutiveDays} 天
                    </span>
                  </div>
                  {rule.lastTriggeredDate && (
                    <p className="text-[10px] text-terracotta">
                      上次触发：{rule.lastTriggeredDate}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled === 1}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({
                        id: rule.id,
                        enabled: checked ? 1 : 0,
                      })
                    }
                  />
                  <button
                    onClick={() => deleteMutation.mutate({ id: rule.id })}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Alert History Toggle */}
      <button
        onClick={() => {
          setShowHistory(!showHistory);
          if (!showHistory && unreadCount > 0) {
            markReadMutation.mutate();
          }
        }}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Bell className="w-3.5 h-3.5" />
        <span>预警历史</span>
        {unreadCount > 0 && (
          <span className="bg-terracotta text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unreadCount}
          </span>
        )}
        {showHistory ? (
          <ChevronUp className="w-3 h-3 ml-auto" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto" />
        )}
      </button>

      {/* Alert History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {historyLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                加载中...
              </p>
            ) : history.length === 0 ? (
              <Card className="p-4 text-center">
                <Check className="w-6 h-6 text-sage mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">
                  暂无预警记录，一切正常
                </p>
              </Card>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {history.map((alert) => (
                  <Card
                    key={alert.id}
                    className={`p-2.5 ${
                      alert.isRead ? "bg-card" : "bg-terracotta/5 border-terracotta/20"
                    }`}
                  >
                    <p className="text-xs text-foreground leading-relaxed">
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {alert.triggeredDate}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
