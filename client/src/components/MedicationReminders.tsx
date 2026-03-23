import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ArchivedMedStats from "@/components/ArchivedMedStats";
import {
  Pill,
  Plus,
  Trash2,
  Clock,
  Edit2,
  Check,
  X,
  Bell,
  Timer,
  Package,
  CalendarPlus,
  FileText,
  AlertTriangle,
  CheckSquare,
  Square,
  Power,
  PowerOff,
  MoreVertical,
  Undo2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Loader2,
  Archive,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TimePicker from "@/components/TimePicker";
import AnimatedNumber from "@/components/AnimatedNumber";
import StockChangeLogPanel from "@/components/StockChangeLogPanel";
import { exportSingleReminder, exportAllReminders } from "@/lib/icsExport";
import { getLocalDateStr } from "@shared/timezone";

import {
  ReminderFormFields,
  SwipeToDelete,
  ALL_DAYS,
  EMPTY_FORM,
  formatRepeatDays,
  formatOffset,
  formatTime,
} from "./medReminder";
import type { ReminderForm } from "./medReminder";

export default function MedicationReminders() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ReminderForm>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ReminderForm>({ ...EMPTY_FORM });
  // Reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<any[]>([]);
  // Batch edit mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchTimeHour, setBatchTimeHour] = useState(8);
  const [batchTimeMinute, setBatchTimeMinute] = useState(0);
  // Batch restock
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [stockLogOpenId, setStockLogOpenId] = useState<number | null>(null);
  const [restockQuantity, setRestockQuantity] = useState(30);
  const [restockDate, setRestockDate] = useState(() => getLocalDateStr());
  // Archive
  const [showArchive, setShowArchive] = useState(false);

  const utils = trpc.useUtils();
  const { data: allReminders = [], isLoading } =
    trpc.medReminders.list.useQuery(undefined);

  // Split into active and archived based on endDate
  const todayStr = useMemo(() => getLocalDateStr(), []);
  const reminders = useMemo(() => allReminders.filter((r: any) => !r.endDate || r.endDate >= todayStr), [allReminders, todayStr]);
  const archivedReminders = useMemo(() => allReminders.filter((r: any) => r.endDate && r.endDate < todayStr), [allReminders, todayStr]);
  const { data: medHistory = [] } =
    trpc.medications.history.useQuery(undefined);

  const addMutation = trpc.medReminders.add.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      toast.success("用药提醒已添加");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.medReminders.update.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      setEditingId(null);
      toast.success("用药提醒已更新");
    },
    onError: (err) => toast.error(err.message),
  });

  const [recentlyDeleted, setRecentlyDeleted] = useState<any | null>(null);

  const deleteMutation = trpc.medReminders.delete.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const batchDeleteMutation = trpc.medReminders.batchDelete.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      setSelectedIds(new Set());
      setBatchMode(false);
      toast.success("批量删除成功");
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderMutation = trpc.medReminders.reorder.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      setReorderMode(false);
      toast.success("排序已保存");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startReorder = () => {
    setReorderMode(true);
    setReorderList([...reminders]);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newList = [...reorderList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setReorderList(newList);
  };

  const saveReorder = () => {
    reorderMutation.mutate({ orderedIds: reorderList.map((r: any) => r.id) });
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) { toast.error("请先选择提醒"); return; }
    if (confirm(`确定删除选中的 ${selectedIds.size} 个提醒？`)) {
      batchDeleteMutation.mutate({ ids: Array.from(selectedIds) });
    }
  };

  const toggleMutation = trpc.medReminders.update.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
    },
  });

  const snoozeMutation = trpc.medReminders.snooze.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      toast.success("已设置15分钟后再次提醒");
    },
    onError: (err) => toast.error(err.message),
  });

  const batchUpdateMutation = trpc.medReminders.batchUpdate.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      setSelectedIds(new Set());
      setBatchMode(false);
      toast.success("批量更新成功");
    },
    onError: (err) => toast.error(err.message),
  });

  const batchRestockMutation = trpc.medReminders.batchRestock.useMutation({
    onSuccess: (result) => {
      utils.medReminders.list.invalidate();
      utils.medGroups.grouped.invalidate();
      setShowRestockDialog(false);
      if (result.restocked > 0) {
        toast.success(`已补货 ${result.restocked} 种药品：${result.names.join("、")}`);
      } else {
        toast.info("没有需要补货的药品");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleBatchSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === reminders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reminders.map((r: any) => r.id)));
    }
  };

  const handleBatchEnable = () => {
    if (selectedIds.size === 0) { toast.error("请先选择提醒"); return; }
    batchUpdateMutation.mutate({ ids: Array.from(selectedIds), enabled: 1 });
  };

  const handleBatchDisable = () => {
    if (selectedIds.size === 0) { toast.error("请先选择提醒"); return; }
    batchUpdateMutation.mutate({ ids: Array.from(selectedIds), enabled: 0 });
  };

  const handleBatchTimeChange = () => {
    if (selectedIds.size === 0) { toast.error("请先选择提醒"); return; }
    batchUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      reminderHour: batchTimeHour,
      reminderMinute: batchTimeMinute,
    });
  };

  // Medication name suggestions from history
  const medSuggestions = useMemo(() => {
    return medHistory
      .map((m: any) => m.name)
      .filter((name: string) => name && name.trim());
  }, [medHistory]);

  const handleAdd = () => {
    if (!form.medicationName.trim() || !form.dosage.trim()) {
      toast.error("请填写药品名称和剂量");
      return;
    }
    addMutation.mutate({
      medicationName: form.medicationName,
      dosage: form.dosage,
      reminderHour: form.reminderHour,
      reminderMinute: form.reminderMinute,
      reminderTimes: form.reminderTimes.length > 0 ? form.reminderTimes : null,
      repeatDays: form.repeatDays,
      offsetMinutes: form.offsetMinutes,
      stockQuantity: form.trackStock ? (Number(form.stockQuantity) || 0) : null,
      dailyDosageCount: form.reminderTimes.length > 0 ? form.reminderTimes.length : (Number(form.dailyDosageCount) || 1),
      stockAlertDays: Number(form.stockAlertDays) || 7,
      instructionUrl: form.instructionUrl.trim() || null,
      expirationDate: form.expirationDate || null,
      expirationAlertDays: Number(form.expirationAlertDays) || 30,
      groupId: form.groupId,
      intervalHours: form.intervalHours,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    });
  };

  const handleUpdate = () => {
    if (!editForm.medicationName.trim() || !editForm.dosage.trim()) {
      toast.error("请填写药品名称和剂量");
      return;
    }
    if (editingId === null) return;
    updateMutation.mutate({
      id: editingId,
      medicationName: editForm.medicationName,
      dosage: editForm.dosage,
      reminderHour: editForm.reminderHour,
      reminderMinute: editForm.reminderMinute,
      reminderTimes: editForm.reminderTimes.length > 0 ? editForm.reminderTimes : null,
      repeatDays: editForm.repeatDays,
      offsetMinutes: editForm.offsetMinutes,
      stockQuantity: editForm.trackStock ? (Number(editForm.stockQuantity) || 0) : null,
      dailyDosageCount: editForm.reminderTimes.length > 0 ? editForm.reminderTimes.length : (Number(editForm.dailyDosageCount) || 1),
      stockAlertDays: Number(editForm.stockAlertDays) || 7,
      instructionUrl: editForm.instructionUrl.trim() || null,
      expirationDate: editForm.expirationDate || null,
      expirationAlertDays: Number(editForm.expirationAlertDays) || 30,
      groupId: editForm.groupId,
      intervalHours: editForm.intervalHours,
      startDate: editForm.startDate || null,
      endDate: editForm.endDate || null,
    });
  };

  const startEdit = (reminder: any) => {
    setEditingId(reminder.id);
    setEditForm({
      medicationName: reminder.medicationName,
      dosage: reminder.dosage,
      reminderHour: reminder.reminderHour,
      reminderMinute: reminder.reminderMinute,
      reminderTimes: reminder.reminderTimes ?? [],
      repeatDays: reminder.repeatDays ?? [...ALL_DAYS],
      offsetMinutes: reminder.offsetMinutes ?? 0,
      trackStock: reminder.stockQuantity !== null && reminder.stockQuantity !== undefined,
      stockQuantity: reminder.stockQuantity ?? 30,
      dailyDosageCount: reminder.dailyDosageCount ?? 1,
      stockAlertDays: reminder.stockAlertDays ?? 7,
      instructionUrl: reminder.instructionUrl ?? "",
      expirationDate: reminder.expirationDate ?? "",
      expirationAlertDays: reminder.expirationAlertDays ?? 30,
      groupId: reminder.groupId ?? null,
      intervalHours: reminder.intervalHours ?? null,
      startDate: reminder.startDate ?? "",
      endDate: reminder.endDate ?? "",
    });
  };

  const addMutationForUndo = trpc.medReminders.add.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      toast.success("已撤销删除");
    },
  });

  const handleDeleteWithUndo = (id: number, reminder: any) => {
    deleteMutation.mutate({ id });
    toast("已删除", {
      description: `「${reminder.medicationName}」用药提醒已删除`,
      action: {
        label: "撤销",
        onClick: () => {
          addMutationForUndo.mutate({
            medicationName: reminder.medicationName,
            dosage: reminder.dosage,
            reminderHour: reminder.reminderHour,
            reminderMinute: reminder.reminderMinute,
            reminderTimes: reminder.reminderTimes ?? null,
            repeatDays: reminder.repeatDays ?? [...ALL_DAYS],
            offsetMinutes: reminder.offsetMinutes ?? 0,
            stockQuantity: reminder.stockQuantity ?? null,
            dailyDosageCount: reminder.dailyDosageCount ?? 1,
            stockAlertDays: reminder.stockAlertDays ?? 7,
            instructionUrl: reminder.instructionUrl ?? null,
            expirationDate: reminder.expirationDate ?? null,
            expirationAlertDays: reminder.expirationAlertDays ?? 30,
            groupId: reminder.groupId ?? null,
            intervalHours: reminder.intervalHours ?? null,
            startDate: reminder.startDate ?? null,
            endDate: reminder.endDate ?? null,
          });
        },
      },
      duration: 5000,
    });
  };

  // Count low-stock reminders for showing restock button
  const lowStockCount = useMemo(() => {
    return reminders.filter((r: any) => {
      if (r.stockQuantity === null || r.stockQuantity === undefined) return false;
      const daily = r.dailyDosageCount ?? 1;
      const days = daily > 0 ? Math.floor(r.stockQuantity / daily) : 999;
      const alertDays = r.stockAlertDays ?? 7;
      return days <= alertDays;
    }).length;
  }, [reminders]);

  // Helper: check if a reminder has low stock
  const isLowStock = useCallback((reminder: any): boolean => {
    if (reminder.stockQuantity === null || reminder.stockQuantity === undefined) return false;
    const daily = reminder.dailyDosageCount ?? 1;
    const days = daily > 0 ? Math.floor(reminder.stockQuantity / daily) : 999;
    const alertDays = reminder.stockAlertDays ?? 7;
    return days <= alertDays;
  }, []);

  // Group reminders by time
  const groupedReminders = useMemo(() => {
    const groups: Record<string, typeof reminders> = {};
    for (const r of reminders) {
      const key = formatTime(r.reminderHour, r.reminderMinute);
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [reminders]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-terracotta" />
          <h3 className="font-serif font-semibold text-foreground">
            用药提醒
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reminders.length >= 2 && !reorderMode && (
            <Button
              variant={batchMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setBatchMode(!batchMode);
                setSelectedIds(new Set());
              }}
              className="gap-1 h-8 text-xs"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {batchMode ? "取消" : "批量"}
            </Button>
          )}
          {reminders.length >= 2 && !batchMode && !reorderMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={startReorder}
              className="gap-1 h-8 text-xs"
            >
              <GripVertical className="w-3.5 h-3.5" />
              排序
            </Button>
          )}
          {reorderMode && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={saveReorder}
                disabled={reorderMutation.isPending}
                className="gap-1 h-8 text-xs"
              >
                <Check className="w-3.5 h-3.5" />
                保存排序
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReorderMode(false)}
                className="gap-1 h-8 text-xs"
              >
                <X className="w-3.5 h-3.5" />
                取消
              </Button>
            </>
          )}
          {!batchMode && !reorderMode && lowStockCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRestockDialog(true)}
              className="gap-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
              title={`${lowStockCount} 种药品库存不足`}
            >
              <Package className="w-3.5 h-3.5" />
              补货 ({lowStockCount})
            </Button>
          )}
          {!batchMode && !reorderMode && reminders.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const enabledReminders = reminders.filter((r: any) => r.enabled === 1);
                if (enabledReminders.length === 0) {
                  toast.error("没有已启用的提醒可导出");
                  return;
                }
                exportAllReminders(enabledReminders);
                toast.success("已生成日历文件，请在弹出的对话框中添加到日历");
              }}
              className="gap-1 h-8 text-xs"
              title="导出全部提醒到系统日历"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              导入日历
            </Button>
          )}
          {!batchMode && !reorderMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(!showAdd)}
              className="gap-1 h-8 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              添加
            </Button>
          )}
        </div>
      </div>

      {/* Batch edit toolbar */}
      {batchMode && (
        <div className="bg-muted/50 border border-border/50 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={selectAll}
              className="text-xs text-terracotta hover:underline flex items-center gap-1"
            >
              {selectedIds.size === reminders.length ? (
                <><CheckSquare className="w-3.5 h-3.5" /> 取消全选</>
              ) : (
                <><Square className="w-3.5 h-3.5" /> 全选 ({reminders.length})</>
              )}
            </button>
            <span className="text-xs text-muted-foreground">已选 {selectedIds.size} 项</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchEnable}
              disabled={selectedIds.size === 0 || batchUpdateMutation.isPending}
              className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              <Power className="w-3.5 h-3.5" />
              全部启用
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchDisable}
              disabled={selectedIds.size === 0 || batchUpdateMutation.isPending}
              className="gap-1 text-muted-foreground"
            >
              <PowerOff className="w-3.5 h-3.5" />
              全部禁用
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0 || batchDeleteMutation.isPending}
              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              批量删除
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">统一时间:</span>
            <TimePicker
              hour={batchTimeHour}
              minute={batchTimeMinute}
              onChange={(h, m) => { setBatchTimeHour(h); setBatchTimeMinute(m); }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchTimeChange}
              disabled={selectedIds.size === 0 || batchUpdateMutation.isPending}
              className="gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              应用
            </Button>
          </div>
        </div>
      )}

      {!batchMode && (
        <p className="text-xs text-muted-foreground">
          为每种药品设置独立的提醒时间、剂量和重复日，到时间自动推送通知。点击"导入日历"可将提醒添加到 iPhone 系统日历，即使关闭应用也能收到提醒。左滑可快速删除提醒。
        </p>
      )}

      {/* Add form */}
      {showAdd && (
        <ReminderFormFields
          formData={form}
          setFormData={setForm}
          onSubmit={handleAdd}
          submitLabel="确认添加"
          isPending={addMutation.isPending}
          onCancel={() => {
            setShowAdd(false);
            setForm({ ...EMPTY_FORM });
          }}
          medSuggestions={medSuggestions}
        />
      )}

      {/* Batch restock dialog */}
      {showRestockDialog && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-red-500" />
            <h4 className="font-medium text-sm text-red-700 dark:text-red-400">一键补货</h4>
          </div>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            将所有库存不足的药品（{lowStockCount} 种）重置为指定数量，库存从补货日期开始计算。
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground shrink-0">补货日期：</label>
            <Input
              type="date"
              value={restockDate}
              onChange={(e) => setRestockDate(e.target.value)}
              className="w-36 h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground shrink-0">补货数量：</label>
            <Input
              type="number"
              min={1}
              max={9999}
              value={restockQuantity}
              onChange={(e) => setRestockQuantity(Math.max(1, Number(e.target.value) || 30))}
              className="w-24 h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => batchRestockMutation.mutate({ restockQuantity, restockDate })}
              disabled={batchRestockMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white gap-1"
            >
              {batchRestockMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Package className="w-3.5 h-3.5" />
              )}
              确认补货
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRestockDialog(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* Reorder mode list */}
      {reorderMode && reorderList.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">使用上下箭头调整药品顺序，完成后点击"保存排序"。</p>
          {reorderList.map((reminder: any, index: number) => (
            <div
              key={reminder.id}
              className="flex items-center gap-2 border rounded-xl p-3 bg-card"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{reminder.medicationName}</p>
                <p className="text-xs text-muted-foreground">{reminder.dosage}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === 0}
                  onClick={() => moveItem(index, 'up')}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === reorderList.length - 1}
                  onClick={() => moveItem(index, 'down')}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reminders list grouped by time */}
      {!reorderMode && isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          加载中...
        </div>
      ) : !reorderMode && reminders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无用药提醒</p>
          <p className="text-xs mt-1">点击上方"添加"按钮设置用药提醒</p>
        </div>
      ) : !reorderMode ? (
        <div className="space-y-3">
          {groupedReminders.map(([time, items]) => (
            <div key={time} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>{time}</span>
              </div>
              {items.map((reminder: any) => (
                <SwipeToDelete
                  key={reminder.id}
                  onDelete={() => handleDeleteWithUndo(reminder.id, reminder)}
                >
                  <div
                    className={`border rounded-xl p-3 transition-all ${
                      reminder.enabled && isLowStock(reminder)
                        ? "border-red-400 dark:border-red-500 bg-red-50/50 dark:bg-red-950/20"
                        : reminder.enabled
                          ? "border-border/50"
                          : "border-border/30 opacity-60"
                    } ${batchMode && selectedIds.has(reminder.id) ? "ring-2 ring-terracotta/50 bg-terracotta/5" : ""}`}
                    onClick={batchMode ? () => toggleBatchSelect(reminder.id) : undefined}
                  >
                    {batchMode && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(reminder.id)
                            ? "bg-terracotta border-terracotta text-white"
                            : "border-border bg-card"
                        }`}>
                          {selectedIds.has(reminder.id) && <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-sm font-medium text-foreground">{reminder.medicationName}</span>
                        <span className="text-xs text-muted-foreground">{reminder.dosage}</span>
                      </div>
                    )}
                    {editingId === reminder.id ? (
                      /* Edit mode */
                      <ReminderFormFields
                        formData={editForm}
                        setFormData={setEditForm}
                        onSubmit={handleUpdate}
                        submitLabel="保存"
                        isPending={updateMutation.isPending}
                        onCancel={() => setEditingId(null)}
                        medSuggestions={medSuggestions}
                      />
                    ) : (
                      /* View mode */
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <Pill className={`w-4 h-4 shrink-0 ${isLowStock(reminder) ? "text-red-500" : "text-terracotta"}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-foreground text-sm truncate">
                                  {reminder.medicationName}
                                </p>
                                {reminder.instructionUrl && (
                                  <a
                                    href={reminder.instructionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-terracotta hover:text-terracotta/80 shrink-0"
                                    title="查看说明书"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {reminder.dosage}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Switch
                              checked={reminder.enabled === 1}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  id: reminder.id,
                                  enabled: checked ? 1 : 0,
                                })
                              }
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => startEdit(reminder)}>
                                  <Edit2 className="w-3.5 h-3.5 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  exportSingleReminder(reminder);
                                  toast.success("已生成日历文件");
                                }}>
                                  <CalendarPlus className="w-3.5 h-3.5 mr-2" />
                                  导出到日历
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteWithUndo(reminder.id, reminder)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {/* Tags row: times + repeat days + offset + snooze */}
                        <div className="flex items-center gap-2 flex-wrap pl-7">
                          {reminder.reminderTimes && reminder.reminderTimes.length > 0 ? (
                            <span className="text-xs bg-terracotta/10 text-terracotta px-2 py-0.5 rounded-full">
                              {reminder.reminderTimes.length}次/天: {[...reminder.reminderTimes].sort((a: any, b: any) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)).map((t: any) => formatTime(t.hour, t.minute)).join(", ")}
                            </span>
                          ) : null}
                          <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                            {formatRepeatDays(reminder.repeatDays)}
                          </span>
                          {(reminder.offsetMinutes ?? 0) !== 0 && (
                            <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                              {formatOffset(reminder.offsetMinutes)}
                            </span>
                          )}
                          {reminder.snoozedUntil && (
                            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              已暂停至 {reminder.snoozedUntil.slice(11)}
                            </span>
                          )}
                          {reminder.stockQuantity !== null && reminder.stockQuantity !== undefined && (
                            isLowStock(reminder) ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setStockLogOpenId(stockLogOpenId === reminder.id ? null : reminder.id); }}
                                className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                                title="点击查看库存日志和撤销补货"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                库存不足 (<AnimatedNumber value={reminder.stockQuantity} />)
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setStockLogOpenId(stockLogOpenId === reminder.id ? null : reminder.id); }}
                                className="text-xs px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="点击查看库存日志和撤销补货"
                              >
                                库存 <AnimatedNumber value={reminder.stockQuantity} />
                              </button>
                            )
                          )}
                          {(reminder.startDate || reminder.endDate) && (
                            <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CalendarPlus className="w-3 h-3" />
                              {reminder.startDate && reminder.endDate
                                ? `${reminder.startDate} ~ ${reminder.endDate}`
                                : reminder.startDate
                                  ? `起始 ${reminder.startDate}`
                                  : `至 ${reminder.endDate}`}
                            </span>
                          )}
                          {reminder.expirationDate && (() => {
                            const expDate = new Date(reminder.expirationDate + "T00:00:00");
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const diffMs = expDate.getTime() - today.getTime();
                            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                            const alertDays = reminder.expirationAlertDays ?? 30;
                            if (daysLeft < 0) {
                              return (
                                <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  已过期{Math.abs(daysLeft)}天
                                </span>
                              );
                            } else if (daysLeft <= alertDays) {
                              return (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {daysLeft}天后过期
                                </span>
                              );
                            } else {
                              return (
                                <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                                  有效期至 {reminder.expirationDate}
                                </span>
                              );
                            }
                          })()}
                          {reminder.intervalHours && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              每{reminder.intervalHours}小时
                            </span>
                          )}
                          {reminder.enabled === 1 && !reminder.snoozedUntil && (
                            <button
                              onClick={() =>
                                snoozeMutation.mutate({ id: reminder.id })
                              }
                              className="text-xs text-muted-foreground hover:text-terracotta transition-colors"
                              title="推迟15分钟提醒"
                            >
                              稍后提醒
                            </button>
                          )}
                          {reminder.enabled === 1 && (() => {
                            const now = new Date();
                            const todayDay = now.getDay();
                            const repeatDays: number[] = reminder.repeatDays ?? ALL_DAYS;
                            const times = reminder.reminderTimes && reminder.reminderTimes.length > 0
                              ? [...reminder.reminderTimes].sort((a: any, b: any) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                              : [{ hour: reminder.reminderHour, minute: reminder.reminderMinute }];
                            // Find next dose time
                            let nextDoseMin = Infinity;
                            for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
                              const checkDay = (todayDay + dayOffset) % 7;
                              if (!repeatDays.includes(checkDay)) continue;
                              for (const t of times) {
                                const doseDate = new Date(now);
                                doseDate.setDate(doseDate.getDate() + dayOffset);
                                doseDate.setHours(t.hour, t.minute, 0, 0);
                                const diffMin = Math.round((doseDate.getTime() - now.getTime()) / 60000);
                                if (diffMin > 0 && diffMin < nextDoseMin) {
                                  nextDoseMin = diffMin;
                                }
                              }
                              if (nextDoseMin < Infinity) break;
                            }
                            if (nextDoseMin < Infinity) {
                              const hours = Math.floor(nextDoseMin / 60);
                              const mins = nextDoseMin % 60;
                              const label = hours > 0 ? `${hours}小时${mins}分钟后` : `${mins}分钟后`;
                              return (
                                <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Timer className="w-3 h-3" />
                                  下次 {label}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    )}
                  {/* Stock change log panel - shown when stock label is clicked */}
                  {stockLogOpenId === reminder.id && (
                    <StockChangeLogPanel reminderId={reminder.id} />
                  )}
                  </div>
                </SwipeToDelete>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {/* Archived medications section */}
      {archivedReminders.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showArchive ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Archive className="w-4 h-4" />
            <span>归档药品 ({archivedReminders.length})</span>
          </button>
          {showArchive && (
            <div className="mt-2 space-y-2">
              {archivedReminders.map((reminder: any) => (
                <div
                  key={reminder.id}
                  className="border border-border/30 rounded-xl p-3 opacity-60 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Archive className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          {reminder.medicationName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reminder.dosage}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            updateMutation.mutate({ id: reminder.id, endDate: null });
                            toast.success("已恢复为活跃药品");
                          }}>
                            <Undo2 className="w-3.5 h-3.5 mr-2" />
                            恢复为活跃
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startEdit(reminder)}>
                            <Edit2 className="w-3.5 h-3.5 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteWithUndo(reminder.id, reminder)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pl-7 mt-1">
                    <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                      {reminder.startDate && `${reminder.startDate} ~ `}{reminder.endDate}
                    </span>
                    {reminder.reminderTimes && reminder.reminderTimes.length > 0 ? (
                      <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                        {reminder.reminderTimes.length}次/天
                      </span>
                    ) : null}
                    <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                      {formatRepeatDays(reminder.repeatDays)}
                    </span>
                  </div>
                  <ArchivedMedStats reminderId={reminder.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
