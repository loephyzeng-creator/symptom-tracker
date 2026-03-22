/**
 * Medication Stock Management Component
 * Shows stock levels, estimated run-out dates, and low-stock warnings.
 * Allows users to restock with date tracking. Stock is computed in real-time.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Package,
  AlertTriangle,
  Check,
  Pill,
  Calendar,
  TrendingDown,
  CalendarPlus,
  PackagePlus,
  History,
  Loader2,
  ArrowDown,
  ArrowUp,
  Undo2,
} from "lucide-react";
import { exportSingleStockReminder, exportAllStockReminders } from "@/lib/icsExport";
import AnimatedNumber from "@/components/AnimatedNumber";
import StockChangeLogPanel from "@/components/StockChangeLogPanel";
import { getLocalDateStr } from "@shared/timezone";

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

function getTodayStr(): string {
  return getLocalDateStr();
}

// StockChangeLogPanel is now imported from @/components/StockChangeLogPanel

export default function MedicationStock() {
  const [restockingId, setRestockingId] = useState<number | null>(null);
  const [restockQuantity, setRestockQuantity] = useState<string>("30");
  const [restockDate, setRestockDate] = useState(getTodayStr);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const utils = trpc.useUtils();
  const { data: stockItems = [], isLoading } =
    trpc.medReminders.stockStatus.useQuery(undefined, {
      staleTime: 30_000,
    });

  const updateMutation = trpc.medReminders.update.useMutation({
    onSuccess: () => {
      utils.medReminders.stockStatus.invalidate();
      utils.medReminders.list.invalidate();
    },
  });

  const restockMutation = trpc.medReminders.restock.useMutation({
    onSuccess: () => {
      utils.medReminders.stockStatus.invalidate();
      utils.medReminders.list.invalidate();
      setRestockingId(null);
      setRestockQuantity("30");
      setRestockDate(getTodayStr());
      setSaveAsDefault(false);
      toast.success("补货成功，库存已更新");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: restockHistory = [] } = trpc.medReminders.restockHistory.useQuery(
    { reminderId: historyId! },
    { enabled: historyId !== null }
  );

  const handleRestock = (reminderId: number) => {
    const qty = parseInt(restockQuantity);
    if (isNaN(qty) || qty < 1) {
      toast.error("请输入有效的补货数量");
      return;
    }
    if (!restockDate || !/^\d{4}-\d{2}-\d{2}$/.test(restockDate)) {
      toast.error("请选择有效的补货日期");
      return;
    }
    // Save default restock quantity if checkbox is checked
    if (saveAsDefault) {
      updateMutation.mutate({ id: reminderId, defaultRestockQuantity: qty });
    }
    restockMutation.mutate({ reminderId, restockQuantity: qty, restockDate });
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
    const isRestocking = restockingId === item.reminderId;
    const showingHistory = historyId === item.reminderId;
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
              <AnimatedNumber value={item.stockQuantity} duration={400} />
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

        {/* Restock date info */}
        {item.restockDate && (
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            最近补货：{item.restockDate}
          </div>
        )}


        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => {
              if (isRestocking) {
                setRestockingId(null);
              } else {
                setRestockingId(item.reminderId);
                setHistoryId(null);
                setRestockQuantity(String(item.defaultRestockQuantity ?? 30));
                setRestockDate(getTodayStr());
              }
            }}
            className={`text-xs transition-colors flex items-center gap-1 ${
              isRestocking
                ? "text-terracotta font-medium"
                : "text-muted-foreground hover:text-terracotta"
            }`}
          >
            <PackagePlus className="w-3 h-3" />
            补货
          </button>
          <button
            onClick={() => {
              if (showingHistory) {
                setHistoryId(null);
              } else {
                setHistoryId(item.reminderId);
                setRestockingId(null);
              }
            }}
            className={`text-xs transition-colors flex items-center gap-1 ${
              showingHistory
                ? "text-terracotta font-medium"
                : "text-muted-foreground hover:text-terracotta"
            }`}
          >
            <History className="w-3 h-3" />
            记录
          </button>
          <button
            onClick={() => {
              exportSingleStockReminder(item);
              toast.success("已生成备药提醒日历文件");
            }}
            className="text-xs text-muted-foreground hover:text-terracotta transition-colors flex items-center gap-1"
            title="导出备药提醒到系统日历"
          >
            <CalendarPlus className="w-3 h-3" />
            日历
          </button>
        </div>

        {/* Restock form */}
        {isRestocking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 p-3 bg-muted/40 rounded-lg space-y-2"
          >
            <div className="flex items-center gap-2">
              <label className="text-xs text-foreground shrink-0 w-16">补货日期</label>
              <Input
                type="date"
                value={restockDate}
                onChange={(e) => setRestockDate(e.target.value)}
                className="h-8 text-sm flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-foreground shrink-0 w-16">补货数量</label>
              <Input
                type="number"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(e.target.value)}
                className="h-8 text-sm w-24"
                min={1}
                placeholder="数量"
              />
              {item.defaultRestockQuantity && (
                <span className="text-[10px] text-muted-foreground">
                  默认 {item.defaultRestockQuantity}
                </span>
              )}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="rounded border-border w-3.5 h-3.5 accent-terracotta"
              />
              <span className="text-[11px] text-muted-foreground">记住此数量为默认补货量</span>
            </label>
            <p className="text-[10px] text-muted-foreground">
              库存将从补货日期起，根据用药记录自动扣减
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 bg-terracotta hover:bg-terracotta/90 text-white gap-1"
                onClick={() => handleRestock(item.reminderId)}
                disabled={restockMutation.isPending}
              >
                {restockMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                确认补货
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setRestockingId(null)}
              >
                取消
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stock change log timeline */}
        {showingHistory && (
          <StockChangeLogPanel reminderId={item.reminderId} />
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Export all button */}
      {stockItems.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportAllStockReminders(stockItems);
              toast.success("已生成全部备药提醒日历文件");
            }}
            className="gap-1"
          >
            <CalendarPlus className="w-4 h-4" />
            全部导入日历
          </Button>
        </div>
      )}

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
