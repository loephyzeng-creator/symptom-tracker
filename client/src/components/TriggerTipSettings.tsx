/**
 * TriggerTipSettings — Settings UI to customize trigger-specific health tips.
 * Users can edit recommended/avoid items and the summary tip for each trigger.
 * Changes are saved to DB and override the built-in defaults.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { DEFAULT_TRIGGER_TIPS, type TriggerTipData } from "./TriggerTips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Save,
  RotateCcw,
  Loader2,
  Lightbulb,
} from "lucide-react";

export default function TriggerTipSettings() {
  const customTipsQuery = trpc.triggerTips.list.useQuery();
  const upsertMutation = trpc.triggerTips.upsert.useMutation({
    onSuccess: () => {
      customTipsQuery.refetch();
      toast.success("保存成功");
    },
    onError: () => toast.error("保存失败"),
  });
  const deleteMutation = trpc.triggerTips.delete.useMutation({
    onSuccess: () => {
      customTipsQuery.refetch();
      toast.success("已恢复默认");
    },
    onError: () => toast.error("操作失败"),
  });

  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);

  // Merge defaults with custom overrides for display
  const allTips = useMemo(() => {
    return DEFAULT_TRIGGER_TIPS.map((def) => {
      const custom = customTipsQuery.data?.find((c) => c.trigger === def.trigger);
      if (custom) {
        return {
          ...def,
          title: custom.title || def.title,
          recommended: custom.recommended as string[],
          avoid: custom.avoid as string[],
          tip: custom.tip || def.tip,
          isCustomized: true,
        };
      }
      return { ...def, isCustomized: false };
    });
  }, [customTipsQuery.data]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        自定义每个诱因的调理建议。修改后会覆盖默认内容，可随时恢复默认。
      </p>
      {allTips.map((tip) => (
        <TriggerTipEditor
          key={tip.trigger}
          tip={tip}
          isExpanded={expandedTrigger === tip.trigger}
          onToggle={() =>
            setExpandedTrigger(expandedTrigger === tip.trigger ? null : tip.trigger)
          }
          onSave={(data) =>
            upsertMutation.mutate({
              trigger: tip.trigger,
              title: data.title,
              recommended: data.recommended,
              avoid: data.avoid,
              tip: data.tip,
            })
          }
          onReset={() => deleteMutation.mutate({ trigger: tip.trigger })}
          saving={upsertMutation.isPending}
          isCustomized={tip.isCustomized}
        />
      ))}
    </div>
  );
}

/* ─── Single trigger tip editor ─── */
function TriggerTipEditor({
  tip,
  isExpanded,
  onToggle,
  onSave,
  onReset,
  saving,
  isCustomized,
}: {
  tip: TriggerTipData & { isCustomized: boolean };
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (data: { title: string; recommended: string[]; avoid: string[]; tip: string }) => void;
  onReset: () => void;
  saving: boolean;
  isCustomized: boolean;
}) {
  const Icon = tip.icon;
  const [title, setTitle] = useState(tip.title);
  const [recommended, setRecommended] = useState<string[]>(tip.recommended);
  const [avoid, setAvoid] = useState<string[]>(tip.avoid);
  const [tipText, setTipText] = useState(tip.tip);
  const [newRecommended, setNewRecommended] = useState("");
  const [newAvoid, setNewAvoid] = useState("");

  // Sync state when data changes (e.g., after reset)
  useEffect(() => {
    setTitle(tip.title);
    setRecommended(tip.recommended);
    setAvoid(tip.avoid);
    setTipText(tip.tip);
  }, [tip.title, tip.recommended, tip.avoid, tip.tip]);

  const handleAddRecommended = () => {
    const trimmed = newRecommended.trim();
    if (trimmed && !recommended.includes(trimmed)) {
      setRecommended([...recommended, trimmed]);
      setNewRecommended("");
    }
  };

  const handleAddAvoid = () => {
    const trimmed = newAvoid.trim();
    if (trimmed && !avoid.includes(trimmed)) {
      setAvoid([...avoid, trimmed]);
      setNewAvoid("");
    }
  };

  return (
    <div className={`rounded-lg border ${tip.colorScheme.border} ${tip.colorScheme.bg} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <Icon className={`w-4 h-4 shrink-0 ${tip.colorScheme.chevron}`} />
        <span className={`text-xs font-medium flex-1 ${tip.colorScheme.titleText}`}>
          {tip.trigger}
          {isCustomized && (
            <span className="ml-1.5 text-[10px] opacity-60">（已自定义）</span>
          )}
        </span>
        {isExpanded ? (
          <ChevronUp className={`w-3.5 h-3.5 ${tip.colorScheme.chevron}`} />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 ${tip.colorScheme.chevron}`} />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-3 space-y-3"
          >
            {/* Title */}
            <div>
              <label className="text-[11px] font-semibold text-foreground/70 mb-1 block">
                提示标题
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-8 bg-background/50"
                placeholder="例：上火可加重头晕，注意饮食调理"
              />
            </div>

            {/* Recommended items */}
            <div>
              <label className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5 block">
                推荐食物 / 饮品
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {recommended.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="text-[10px] bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 gap-0.5 pr-1"
                  >
                    {item}
                    <button
                      onClick={() => setRecommended(recommended.filter((r) => r !== item))}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={newRecommended}
                  onChange={(e) => setNewRecommended(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddRecommended();
                    }
                  }}
                  placeholder="添加推荐项..."
                  className="text-xs h-7 bg-background/50 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddRecommended}
                  disabled={!newRecommended.trim()}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Avoid items */}
            <div>
              <label className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1.5 block">
                应避免
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {avoid.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="text-[10px] bg-red-100/80 text-red-600 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800 gap-0.5 pr-1"
                  >
                    {item}
                    <button
                      onClick={() => setAvoid(avoid.filter((a) => a !== item))}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={newAvoid}
                  onChange={(e) => setNewAvoid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddAvoid();
                    }
                  }}
                  placeholder="添加避免项..."
                  className="text-xs h-7 bg-background/50 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddAvoid}
                  disabled={!newAvoid.trim()}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Tip text */}
            <div>
              <label className="text-[11px] font-semibold text-foreground/70 mb-1 flex items-center gap-1 block">
                <Lightbulb className="w-3 h-3" />
                调理建议
              </label>
              <Textarea
                value={tipText}
                onChange={(e) => setTipText(e.target.value)}
                className="text-xs bg-background/50 resize-none min-h-[60px]"
                placeholder="输入调理建议..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() =>
                  onSave({ title, recommended, avoid, tip: tipText })
                }
                disabled={saving}
                className="flex-1 h-8 text-xs bg-terracotta hover:bg-terracotta/90 text-white"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Save className="w-3 h-3 mr-1" />
                )}
                保存
              </Button>
              {isCustomized && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReset}
                  className="h-8 text-xs gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  恢复默认
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
