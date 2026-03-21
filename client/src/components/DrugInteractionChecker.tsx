import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Interaction {
  drugA: string;
  drugB: string;
  severity: "mild" | "moderate" | "severe";
  description: string;
  recommendation: string | null;
}

const SEVERITY_CONFIG = {
  severe: {
    label: "严重",
    bg: "bg-destructive/10 border-destructive/30",
    text: "text-destructive",
    icon: ShieldAlert,
    badge: "bg-destructive/15 text-destructive",
  },
  moderate: {
    label: "中等",
    bg: "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700",
    text: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangle,
    badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  },
  mild: {
    label: "轻微",
    bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-400",
    icon: Info,
    badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  },
};

export default function DrugInteractionChecker() {
  const [expanded, setExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const { data: savedInteractions, isLoading: listLoading } =
    trpc.drugInteractions.list.useQuery(undefined, {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    });

  const analyzeMutation = trpc.drugInteractions.analyze.useMutation({
    onSuccess: (data) => {
      if (data.interactions.length === 0) {
        toast.success("未发现药品交互风险");
      } else {
        toast.warning(data.message);
      }
      utils.drugInteractions.list.invalidate();
    },
    onError: () => {
      toast.error("分析失败，请稍后重试");
    },
  });

  const utils = trpc.useUtils();

  const interactions: Interaction[] = savedInteractions ?? [];
  const hasSevere = interactions.some((i) => i.severity === "severe");
  const hasModerate = interactions.some((i) => i.severity === "moderate");

  const toggleItem = (idx: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Sort: severe first, then moderate, then mild
  const sorted = [...interactions].sort((a, b) => {
    const order = { severe: 0, moderate: 1, mild: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-serif font-semibold text-sm">药品交互检查</h3>
          {interactions.length > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                hasSevere
                  ? "bg-destructive/15 text-destructive"
                  : hasModerate
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              }`}
            >
              {interactions.length} 项
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="h-7 text-xs gap-1"
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {analyzeMutation.isPending ? "分析中..." : "AI分析"}
          </Button>
          {interactions.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {(listLoading || analyzeMutation.isPending) && interactions.length === 0 && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">
            {analyzeMutation.isPending ? "AI正在分析药品交互..." : "加载中..."}
          </span>
        </div>
      )}

      {/* No interactions */}
      {!listLoading && !analyzeMutation.isPending && interactions.length === 0 && (
        <div className="text-center py-4">
          <ShieldCheck className="w-8 h-8 text-sage mx-auto mb-2 opacity-50" />
          <p className="text-xs text-muted-foreground">
            点击"AI分析"检查当前药品的交互风险
          </p>
        </div>
      )}

      {/* Summary bar (always visible when there are interactions) */}
      {interactions.length > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={`w-full p-3 rounded-xl border text-left transition-all hover:shadow-sm ${
            hasSevere
              ? "bg-destructive/5 border-destructive/20"
              : hasModerate
              ? "bg-amber-50/50 dark:bg-amber-900/5 border-amber-200 dark:border-amber-800"
              : "bg-blue-50/50 dark:bg-blue-900/5 border-blue-200 dark:border-blue-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {hasSevere ? (
              <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
            ) : hasModerate ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="text-xs text-foreground">
              发现 {interactions.length} 项药品交互
              {hasSevere && "，含严重风险"}
              {!hasSevere && hasModerate && "，含中等风险"}
              <span className="text-muted-foreground ml-1">— 点击展开查看</span>
            </span>
          </div>
        </button>
      )}

      {/* Expanded list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {sorted.map((interaction, idx) => {
              const config = SEVERITY_CONFIG[interaction.severity];
              const Icon = config.icon;
              const isOpen = expandedItems.has(idx);

              return (
                <motion.div
                  key={`${interaction.drugA}-${interaction.drugB}-${idx}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`rounded-xl border p-3 ${config.bg}`}
                >
                  <button
                    onClick={() => toggleItem(idx)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {interaction.drugA}
                          </span>
                          <span className="text-xs text-muted-foreground">×</span>
                          <span className="text-sm font-medium text-foreground">
                            {interaction.drugB}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${config.badge}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {interaction.description}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 pt-2 border-t border-current/10">
                          <div className="flex items-start gap-1.5">
                            <span className="text-xs font-medium text-foreground shrink-0">
                              建议：
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {interaction.recommendation}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
