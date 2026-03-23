/**
 * Custom Metrics Manager — CRUD UI for user-defined symptom indicators (localStorage)
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Activity, ArrowUp, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  getCustomMetrics, addCustomMetric, updateCustomMetric, deleteCustomMetric,
} from "@/lib/local-storage";

export default function CustomMetricsManager() {
  const [metrics, setMetrics] = useState(() => getCustomMetrics());
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsHighGood, setNewIsHighGood] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const refresh = () => setMetrics(getCustomMetrics());

  const handleAdd = () => {
    if (!newName.trim()) { toast.error("请输入指标名称"); return; }
    addCustomMetric(newName.trim(), newDesc.trim() || null, newIsHighGood);
    refresh();
    setNewName(""); setNewDesc(""); setNewIsHighGood(0); setShowAddForm(false);
    toast.success("指标已添加");
  };

  const handleUpdate = (id: number) => {
    if (!editName.trim()) { toast.error("请输入指标名称"); return; }
    updateCustomMetric(id, { name: editName.trim(), description: editDesc.trim() || null });
    refresh();
    setEditingId(null);
    toast.success("指标已更新");
  };

  const handleDelete = (id: number) => {
    deleteCustomMetric(id);
    refresh();
    toast.success("指标已删除");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-4 border border-border/50 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-terracotta/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-terracotta" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-sm">自定义症状指标</h3>
            <p className="text-[10px] text-muted-foreground">添加除默认 9 项之外的自定义指标</p>
          </div>
        </div>
        {!showAddForm && (
          <button onClick={() => setShowAddForm(true)} className="text-xs text-terracotta hover:text-terracotta/80 flex items-center gap-1 transition-colors">
            <Plus className="w-3.5 h-3.5" />添加
          </button>
        )}
      </div>
      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="指标名称（如：颈椎疼痛）" className="text-sm bg-muted/50 border-0 h-9" />
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="描述（可选）" className="text-sm bg-muted/50 border-0 h-9" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">评分方向：</span>
              <button onClick={() => setNewIsHighGood(0)} className={`px-2 py-1 rounded text-[11px] transition-colors ${newIsHighGood === 0 ? "bg-terracotta/10 text-terracotta font-medium" : "bg-muted text-muted-foreground"}`}>
                <ArrowUp className="w-3 h-3 inline mr-0.5" />越高越差
              </button>
              <button onClick={() => setNewIsHighGood(1)} className={`px-2 py-1 rounded text-[11px] transition-colors ${newIsHighGood === 1 ? "bg-sage/10 text-sage font-medium" : "bg-muted text-muted-foreground"}`}>
                <ArrowUp className="w-3 h-3 inline mr-0.5" />越高越好
              </button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm" className="bg-terracotta hover:bg-terracotta/90 text-white rounded-lg text-xs">
                <Plus className="w-3 h-3 mr-1" />添加指标
              </Button>
              <Button onClick={() => { setShowAddForm(false); setNewName(""); setNewDesc(""); }} variant="outline" size="sm" className="rounded-lg text-xs">取消</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="space-y-2">
        {metrics.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">暂无自定义指标</p>
        ) : (
          metrics.map((metric) => (
            <div key={metric.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40">
              {editingId === metric.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xs h-7 flex-1 bg-background" />
                  <button onClick={() => handleUpdate(metric.id)} className="text-sage hover:text-sage/80"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 text-terracotta shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{metric.name}</p>
                    {metric.description && <p className="text-[10px] text-muted-foreground truncate">{metric.description}</p>}
                  </div>
                  <button onClick={() => { setEditingId(metric.id); setEditName(metric.name); setEditDesc(metric.description ?? ""); }} className="text-muted-foreground hover:text-foreground p-1">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(metric.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
