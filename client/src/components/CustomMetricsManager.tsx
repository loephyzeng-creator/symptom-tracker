/**
 * Custom Metrics Manager — CRUD UI for user-defined symptom indicators
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Activity, Loader2, ArrowUp, ArrowDown, Pencil, Check, X,
} from "lucide-react";
import { toast } from "sonner";

export default function CustomMetricsManager() {
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsHighGood, setNewIsHighGood] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const utils = trpc.useUtils();
  const metricsQuery = trpc.customMetrics.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const addMutation = trpc.customMetrics.add.useMutation({
    onSuccess: () => {
      utils.customMetrics.list.invalidate();
      setNewName("");
      setNewDesc("");
      setNewIsHighGood(0);
      setShowAddForm(false);
      toast.success("自定义指标已添加");
    },
    onError: (error) => toast.error(`添加失败：${error.message}`),
  });

  const updateMutation = trpc.customMetrics.update.useMutation({
    onSuccess: () => {
      utils.customMetrics.list.invalidate();
      setEditingId(null);
      toast.success("指标已更新");
    },
    onError: (error) => toast.error(`更新失败：${error.message}`),
  });

  const deleteMutation = trpc.customMetrics.delete.useMutation({
    onSuccess: () => {
      utils.customMetrics.list.invalidate();
      toast.success("指标已删除");
    },
    onError: (error) => toast.error(`删除失败：${error.message}`),
  });

  const handleAdd = () => {
    if (!newName.trim()) {
      toast.error("请输入指标名称");
      return;
    }
    addMutation.mutate({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      isHighGood: newIsHighGood,
    });
  };

  const handleUpdate = (id: number) => {
    if (!editName.trim()) {
      toast.error("请输入指标名称");
      return;
    }
    updateMutation.mutate({
      id,
      name: editName.trim(),
      description: editDesc.trim() || undefined,
    });
  };

  const startEdit = (metric: { id: number; name: string; description: string | null }) => {
    setEditingId(metric.id);
    setEditName(metric.name);
    setEditDesc(metric.description ?? "");
  };

  const metrics = metricsQuery.data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border border-border/50 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-terracotta" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">自定义症状指标</h3>
            <p className="text-[10px] text-muted-foreground">
              添加除默认 9 项之外的自定义指标
            </p>
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-terracotta hover:text-terracotta/80 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        )}
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="指标名称（如：颈椎疼痛）"
              className="text-sm bg-muted/50 border-0 h-9"
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="描述（可选，如：颈部僵硬和疼痛程度）"
              className="text-sm bg-muted/50 border-0 h-9"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <span>评分方向：</span>
                <button
                  onClick={() => setNewIsHighGood(0)}
                  className={`px-2 py-1 rounded text-[11px] transition-colors ${
                    newIsHighGood === 0
                      ? "bg-terracotta/10 text-terracotta font-medium"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ArrowUp className="w-3 h-3 inline mr-0.5" />
                  越高越差
                </button>
                <button
                  onClick={() => setNewIsHighGood(1)}
                  className={`px-2 py-1 rounded text-[11px] transition-colors ${
                    newIsHighGood === 1
                      ? "bg-sage/10 text-sage font-medium"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ArrowUp className="w-3 h-3 inline mr-0.5" />
                  越高越好
                </button>
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                size="sm"
                className="bg-terracotta hover:bg-terracotta/90 text-white rounded-lg text-xs"
              >
                {addMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                添加指标
              </Button>
              <Button
                onClick={() => {
                  setShowAddForm(false);
                  setNewName("");
                  setNewDesc("");
                  setNewIsHighGood(0);
                }}
                variant="outline"
                size="sm"
                className="rounded-lg text-xs"
              >
                取消
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics List */}
      {metricsQuery.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : metrics.length === 0 && !showAddForm ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">暂无自定义指标</p>
          <p className="text-xs text-muted-foreground mt-1">
            点击右上角"添加"按钮创建
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {metrics.map((metric) => (
              <motion.div
                key={metric.id}
                layout
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 bg-muted/30 rounded-lg p-2.5"
              >
                {editingId === metric.id ? (
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-sm bg-muted/50 border-0 h-8"
                    />
                    <Input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="描述（可选）"
                      className="text-xs bg-muted/50 border-0 h-7"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleUpdate(metric.id)}
                        className="text-sage hover:text-sage/80"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-terracotta shrink-0" />
                        <span className="text-sm font-medium truncate">{metric.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          metric.isHighGood
                            ? "bg-sage/10 text-sage"
                            : "bg-terracotta/10 text-terracotta"
                        }`}>
                          {metric.isHighGood ? "越高越好" : "越高越差"}
                        </span>
                      </div>
                      {metric.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {metric.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(metric)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`确定删除指标"${metric.name}"吗？相关数据也会被删除。`)) {
                            deleteMutation.mutate({ id: metric.id });
                          }
                        }}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
