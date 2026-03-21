/**
 * Medication Stock Management Component
 * Shows stock levels, estimated run-out dates, and low-stock warnings.
 * Allows users to update stock quantities.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  AlertTriangle,
  Check,
  Pill,
  Calendar,
  TrendingDown,
  Plus,
  Minus,
} from "lucide-react";

function getRemainingColor(days: number, alertDays: number): string {
  if (days <= 0) return "#c45c5c"; // red - empty
  if (days <= alertDays) return "#c49a3c"; // amber - low
  return "#7a9e7e"; // sage green - good
}

function getRemainingLabel(days: number): string {
  if (days <= 0) return "已用完";
  if (days === 1) return "明天用完";
  return `${days} 天`;
}

export default function MedicationStock() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: stockItems = [], isLoading } =
    trpc.medReminders.stockStatus.useQuery(undefined, {
      staleTime: 60_000,
    });

  const updateMutation = trpc.medReminders.update.useMutation({
    onSuccess: () => {
      utils.medReminders.stockStatus.invalidate();
      utils.medReminders.list.invalidate();
      setEditingId(null);
      toast.success("库存已更新");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpdateStock = (reminderId: number) => {
    const qty = parseInt(editQuantity);
    if (isNaN(qty) || qty < 0) {
      toast.error("请输入有效数量");
      return;
    }
    updateMutation.mutate({ id: reminderId, stockQuantity: qty });
  };

  const handleQuickAdjust = (reminderId: number, currentQty: number, delta: number) => {
    const newQty = Math.max(0, currentQty + delta);
    updateMutation.mutate({ id: reminderId, stockQuantity: newQty });
  };

  // Separate into low stock and normal stock
  const { lowStock, normalStock } = useMemo(() => {
    const low = stockItems.filter((s: any) => s.isLow);
    const normal = stockItems.filter((s: any) => !s.isLow);
    return { lowStock: low, normalStock: normal };
  }, [stockItems]);

  if (isLoading) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        加载库存数据...
      </div>
    );
  }

  if (stockItems.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border/50 text-center">
        <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">暂无库存跟踪</p>
        <p className="text-xs text-muted-foreground mt-1">
          在用药提醒中设置库存数量后，这里会显示库存状态
        </p>
      </div>
    );
  }

  const StockItem = ({ item }: { item: any }) => {
    const isEditing = editingId === item.reminderId;
    const color = getRemainingColor(item.daysRemaining, item.alertDays);
    const percentage = item.daysRemaining > 0
      ? Math.min(100, (item.daysRemaining / Math.max(item.alertDays * 2, 30)) * 100)
      : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-card rounded-xl p-4 border shadow-sm transition-all ${
          item.isLow
            ? "border-amber-200 dark:border-amber-800/50"
            : "border-border/50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}20` }}
            >
              {item.isLow ? (
                <AlertTriangle className="w-5 h-5" style={{ color }} />
              ) : (
                <Pill className="w-5 h-5" style={{ color }} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground text-sm truncate">
                {item.medicationName}
              </p>
              <p className="text-xs text-muted-foreground">{item.dosage}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-serif font-bold" style={{ color }}>
              {item.stockQuantity}
            </p>
            <p className="text-[10px] text-muted-foreground">剩余</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>

        {/* Info row */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              每日 {item.dailyDosageCount} 剂
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              预计 {item.estimatedRunOutDate.slice(5)} 用完
            </span>
          </div>
          <span className="font-medium" style={{ color }}>
            {getRemainingLabel(item.daysRemaining)}
          </span>
        </div>

        {/* Edit / Quick adjust */}
        <div className="mt-3 flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full">
              <Input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="h-8 text-sm w-24"
                min={0}
                placeholder="数量"
                autoFocus
              />
              <Button
                size="sm"
                className="h-8 bg-terracotta hover:bg-terracotta/90 text-white"
                onClick={() => handleUpdateStock(item.reminderId)}
                disabled={updateMutation.isPending}
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setEditingId(null)}
              >
                取消
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    handleQuickAdjust(
                      item.reminderId,
                      item.stockQuantity,
                      -item.dailyDosageCount
                    )
                  }
                  className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title={`减少 ${item.dailyDosageCount} 剂`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    handleQuickAdjust(
                      item.reminderId,
                      item.stockQuantity,
                      item.dailyDosageCount
                    )
                  }
                  className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title={`增加 ${item.dailyDosageCount} 剂`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => {
                  setEditingId(item.reminderId);
                  setEditQuantity(String(item.stockQuantity));
                }}
                className="text-xs text-muted-foreground hover:text-terracotta transition-colors ml-auto"
              >
                修改库存
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Low stock warnings */}
      {lowStock.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>库存不足 ({lowStock.length})</span>
          </div>
          {lowStock.map((item: any) => (
            <StockItem key={item.reminderId} item={item} />
          ))}
        </div>
      )}

      {/* Normal stock */}
      {normalStock.length > 0 && (
        <div className="space-y-2">
          {lowStock.length > 0 && (
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="w-4 h-4" />
              <span>库存充足 ({normalStock.length})</span>
            </div>
          )}
          {normalStock.map((item: any) => (
            <StockItem key={item.reminderId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
