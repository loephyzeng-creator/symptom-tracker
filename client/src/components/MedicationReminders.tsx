import { useState, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Pill,
  Plus,
  Trash2,
  Clock,
  Edit2,
  Check,
  X,
  Bell,
  CalendarDays,
  Timer,
  Package,
  CalendarPlus,
  Download,
  FileText,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  CheckSquare,
  Square,
  Power,
  PowerOff,
  Folder,
} from "lucide-react";
import TimePicker from "@/components/TimePicker";
import { exportSingleReminder, exportAllReminders } from "@/lib/icsExport";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const OFFSET_OPTIONS = [
  { value: -60, label: "提前60分钟" },
  { value: -30, label: "提前30分钟" },
  { value: -15, label: "提前15分钟" },
  { value: 0, label: "准时" },
  { value: 15, label: "延后15分钟" },
  { value: 30, label: "延后30分钟" },
  { value: 60, label: "延后60分钟" },
];

interface ReminderForm {
  medicationName: string;
  dosage: string;
  reminderHour: number;
  reminderMinute: number;
  repeatDays: number[];
  offsetMinutes: number;
  trackStock: boolean;
  stockQuantity: number;
  dailyDosageCount: number;
  stockAlertDays: number;
  instructionUrl: string;
  expirationDate: string;
  expirationAlertDays: number;
  groupId: number | null;
}

const EMPTY_FORM: ReminderForm = {
  medicationName: "",
  dosage: "",
  reminderHour: 8,
  reminderMinute: 0,
  repeatDays: [...ALL_DAYS],
  offsetMinutes: 0,
  trackStock: false,
  stockQuantity: 30,
  dailyDosageCount: 1,
  stockAlertDays: 7,
  instructionUrl: "",
  expirationDate: "",
  expirationAlertDays: 30,
  groupId: null,
};

function DaySelector({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  const isAllDays =
    selected.length === 7 && ALL_DAYS.every((d) => selected.includes(d));
  const isWeekdays =
    selected.length === 5 && WEEKDAYS.every((d) => selected.includes(d));

  const toggleDay = (day: number) => {
    if (selected.includes(day)) {
      const next = selected.filter((d) => d !== day);
      if (next.length === 0) return; // Must have at least one day
      onChange(next);
    } else {
      onChange([...selected, day].sort());
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">重复日</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onChange([...ALL_DAYS])}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isAllDays
              ? "bg-terracotta text-white border-terracotta"
              : "border-border text-muted-foreground hover:border-terracotta/50"
          }`}
        >
          每天
        </button>
        <button
          type="button"
          onClick={() => onChange([...WEEKDAYS])}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            isWeekdays && !isAllDays
              ? "bg-terracotta text-white border-terracotta"
              : "border-border text-muted-foreground hover:border-terracotta/50"
          }`}
        >
          工作日
        </button>
      </div>
      <div className="flex gap-1">
        {ALL_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
              selected.includes(day)
                ? "bg-terracotta/90 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>
    </div>
  );
}

function OffsetSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">提醒偏移</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent border border-border rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        {OFFSET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── GroupSelector: Select a medication group for the reminder ─── */
function GroupSelector({
  groupId,
  onChange,
}: {
  groupId: number | null;
  onChange: (gId: number | null) => void;
}) {
  const { data: groups = [] } = trpc.medGroups.list.useQuery(undefined);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Folder className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">药品分组</span>
        <span className="text-xs text-muted-foreground">(可选)</span>
      </div>
      <select
        value={groupId ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? Number(val) : null);
        }}
        className="bg-transparent border border-border rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-terracotta"
      >
        <option value="">未分组</option>
        {groups.map((g: any) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatRepeatDays(days: number[] | null): string {
  if (!days || days.length === 0 || days.length === 7) return "每天";
  const sorted = [...days].sort();
  if (
    sorted.length === 5 &&
    WEEKDAYS.every((d) => sorted.includes(d))
  )
    return "工作日";
  if (
    sorted.length === 2 &&
    sorted.includes(0) &&
    sorted.includes(6)
  )
    return "周末";
  return sorted.map((d) => `周${DAY_LABELS[d]}`).join("、");
}

function formatOffset(offset: number): string {
  if (offset === 0) return "";
  if (offset < 0) return `提前${Math.abs(offset)}分钟`;
  return `延后${offset}分钟`;
}

/* ─── ReminderFormFields: Extracted as top-level component to prevent re-mount on parent re-render ─── */
function ReminderFormFields({
  formData,
  setFormData,
  onSubmit,
  submitLabel,
  isPending,
  onCancel,
  medSuggestions,
}: {
  formData: ReminderForm;
  setFormData: (f: ReminderForm) => void;
  onSubmit: () => void;
  submitLabel: string;
  isPending: boolean;
  onCancel: () => void;
  medSuggestions: string[];
}) {
  return (
    <div
      className="bg-card border border-border/50 rounded-xl p-4 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">药品名称</label>
        <Input
          value={formData.medicationName}
          onChange={(e) =>
            setFormData({ ...formData, medicationName: e.target.value })
          }
          placeholder="输入药品名称"
          list="med-suggestions-form"
        />
        <datalist id="med-suggestions-form">
          {medSuggestions.map((name: string, i: number) => (
            <option key={i} value={name} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">剂量</label>
        <Input
          value={formData.dosage}
          onChange={(e) =>
            setFormData({ ...formData, dosage: e.target.value })
          }
          placeholder="如：10mg、1片、2粒"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">提醒时间</label>
        <TimePicker
          hour={formData.reminderHour}
          minute={formData.reminderMinute}
          onChange={(h, m) =>
            setFormData({ ...formData, reminderHour: h, reminderMinute: m })
          }
        />
      </div>
      <DaySelector
        selected={formData.repeatDays}
        onChange={(days) => setFormData({ ...formData, repeatDays: days })}
      />
      <OffsetSelector
        value={formData.offsetMinutes}
        onChange={(v) => setFormData({ ...formData, offsetMinutes: v })}
      />
      {/* Stock tracking section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">库存跟踪</span>
          <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.trackStock}
              onChange={(e) => setFormData({ ...formData, trackStock: e.target.checked })}
              className="rounded border-border accent-terracotta"
            />
            <span className="text-xs text-muted-foreground">启用</span>
          </label>
        </div>
        {formData.trackStock && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">当前库存</label>
              <Input
                type="number"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                className="h-8 text-sm mt-1"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">每日用量</label>
              <Input
                type="number"
                value={formData.dailyDosageCount}
                onChange={(e) => setFormData({ ...formData, dailyDosageCount: Math.max(1, parseInt(e.target.value) || 1) })}
                className="h-8 text-sm mt-1"
                min={1}
                max={20}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">提前提醒(天)</label>
              <Input
                type="number"
                value={formData.stockAlertDays}
                onChange={(e) => setFormData({ ...formData, stockAlertDays: Math.max(1, parseInt(e.target.value) || 7) })}
                className="h-8 text-sm mt-1"
                min={1}
                max={90}
              />
            </div>
          </div>
        )}
      </div>
      {/* 药品说明书链接 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">说明书链接</span>
          <span className="text-xs text-muted-foreground">(可选)</span>
        </div>
        <Input
          type="url"
          placeholder="输入药品说明书网址..."
          value={formData.instructionUrl}
          onChange={(e) => setFormData({ ...formData, instructionUrl: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
      {/* 药品有效期 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">有效期</span>
          <span className="text-xs text-muted-foreground">(可选)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">过期日期</label>
            <Input
              type="date"
              value={formData.expirationDate}
              onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">提前提醒(天)</label>
            <Input
              type="number"
              value={formData.expirationAlertDays}
              onChange={(e) => setFormData({ ...formData, expirationAlertDays: Math.max(1, parseInt(e.target.value) || 30) })}
              className="h-8 text-sm mt-1"
              min={1}
              max={365}
            />
          </div>
        </div>
      </div>
      {/* 药品分组选择 */}
      <GroupSelector
        groupId={formData.groupId}
        onChange={(gId) => setFormData({ ...formData, groupId: gId })}
      />
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={isPending}
          className="bg-terracotta hover:bg-terracotta/90 text-white"
        >
          {isPending ? "处理中..." : submitLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

/* ─── SwipeToDelete: Touch-based swipe-to-reveal delete button ─── */
function SwipeToDelete({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const DELETE_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = startXRef.current - e.touches[0].clientX;
    currentXRef.current = diff;
    // Only allow left swipe
    if (diff > 0) {
      setOffset(Math.min(diff, DELETE_THRESHOLD));
    } else {
      setOffset(0);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (currentXRef.current >= DELETE_THRESHOLD) {
      setOffset(DELETE_THRESHOLD);
      setShowDelete(true);
    } else {
      setOffset(0);
      setShowDelete(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setOffset(0);
    setShowDelete(false);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl" ref={containerRef}>
      {/* Delete button behind */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-white transition-all"
        style={{ width: `${DELETE_THRESHOLD}px`, opacity: offset / DELETE_THRESHOLD }}
      >
        <button
          onClick={() => {
            onDelete();
            handleReset();
          }}
          className="flex flex-col items-center gap-1 px-3"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-medium">删除</span>
        </button>
      </div>
      {/* Content layer */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: currentXRef.current === 0 ? "transform 0.2s ease" : "none",
        }}
        className="relative bg-card"
      >
        {children}
      </div>
      {/* Tap outside to reset */}
      {showDelete && (
        <div
          className="absolute inset-0"
          style={{ right: `${DELETE_THRESHOLD}px` }}
          onClick={handleReset}
        />
      )}
    </div>
  );
}

export default function MedicationReminders() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ReminderForm>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ReminderForm>({ ...EMPTY_FORM });
  // Batch edit mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchTimeHour, setBatchTimeHour] = useState(8);
  const [batchTimeMinute, setBatchTimeMinute] = useState(0);

  const utils = trpc.useUtils();
  const { data: reminders = [], isLoading } =
    trpc.medReminders.list.useQuery(undefined);
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

  const deleteMutation = trpc.medReminders.delete.useMutation({
    onSuccess: () => {
      utils.medReminders.list.invalidate();
      toast.success("用药提醒已删除");
    },
    onError: (err) => toast.error(err.message),
  });

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
      repeatDays: form.repeatDays,
      offsetMinutes: form.offsetMinutes,
      stockQuantity: form.trackStock ? form.stockQuantity : null,
      dailyDosageCount: form.dailyDosageCount,
      stockAlertDays: form.stockAlertDays,
      instructionUrl: form.instructionUrl.trim() || null,
      expirationDate: form.expirationDate || null,
      expirationAlertDays: form.expirationAlertDays,
      groupId: form.groupId,
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
      repeatDays: editForm.repeatDays,
      offsetMinutes: editForm.offsetMinutes,
      stockQuantity: editForm.trackStock ? editForm.stockQuantity : null,
      dailyDosageCount: editForm.dailyDosageCount,
      stockAlertDays: editForm.stockAlertDays,
      instructionUrl: editForm.instructionUrl.trim() || null,
      expirationDate: editForm.expirationDate || null,
      expirationAlertDays: editForm.expirationAlertDays,
      groupId: editForm.groupId,
    });
  };

  const startEdit = (reminder: any) => {
    setEditingId(reminder.id);
    setEditForm({
      medicationName: reminder.medicationName,
      dosage: reminder.dosage,
      reminderHour: reminder.reminderHour,
      reminderMinute: reminder.reminderMinute,
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
    });
  };

  const handleDeleteWithConfirm = (id: number, name: string) => {
    if (confirm(`确定删除「${name}」的用药提醒？`)) {
      deleteMutation.mutate({ id });
    }
  };

  const formatTime = (h: number, m: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-terracotta" />
          <h3 className="font-serif font-semibold text-foreground">
            用药提醒
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {reminders.length >= 2 && (
            <Button
              variant={batchMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setBatchMode(!batchMode);
                setSelectedIds(new Set());
              }}
              className="gap-1"
            >
              <CheckSquare className="w-4 h-4" />
              {batchMode ? "取消" : "批量"}
            </Button>
          )}
          {!batchMode && reminders.length > 0 && (
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
              className="gap-1"
              title="导出全部提醒到系统日历"
            >
              <CalendarPlus className="w-4 h-4" />
              导入日历
            </Button>
          )}
          {!batchMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(!showAdd)}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
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
          为每种药品设置独立的提醒时间、剂量和重复日，到时间自动推送通知。点击“导入日历”可将提醒添加到 iPhone 系统日历，即使关闭应用也能收到提醒。左滑可快速删除提醒。
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

      {/* Reminders list grouped by time */}
      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          加载中...
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无用药提醒</p>
          <p className="text-xs mt-1">点击上方"添加"按钮设置用药提醒</p>
        </div>
      ) : (
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
                  onDelete={() => handleDeleteWithConfirm(reminder.id, reminder.medicationName)}
                >
                  <div
                    className={`border rounded-xl p-3 transition-all ${
                      reminder.enabled
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
                            <Pill className="w-4 h-4 text-terracotta shrink-0" />
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
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={reminder.enabled === 1}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({
                                  id: reminder.id,
                                  enabled: checked ? 1 : 0,
                                })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => startEdit(reminder)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                exportSingleReminder(reminder);
                                toast.success("已生成日历文件");
                              }}
                              title="导出到系统日历"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteWithConfirm(reminder.id, reminder.medicationName)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Tags row: repeat days + offset + snooze */}
                        <div className="flex items-center gap-2 flex-wrap pl-7">
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
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              (() => {
                                const daily = reminder.dailyDosageCount ?? 1;
                                const days = daily > 0 ? Math.floor(reminder.stockQuantity / daily) : 999;
                                const alertDays = reminder.stockAlertDays ?? 7;
                                return days <= alertDays
                                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                  : "bg-muted/60 text-muted-foreground";
                              })()
                            }`}>
                              库存 {reminder.stockQuantity}
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
                        </div>
                      </div>
                    )}
                  </div>
                </SwipeToDelete>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
