import { useState, useMemo, useRef, useCallback } from "react";
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
  reminderTimes: {hour: number; minute: number}[];
  repeatDays: number[];
  offsetMinutes: number;
  trackStock: boolean;
  stockQuantity: number | string;
  dailyDosageCount: number | string;
  stockAlertDays: number | string;
  instructionUrl: string;
  expirationDate: string;
  expirationAlertDays: number | string;
  groupId: number | null;
  intervalHours: number | null;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: ReminderForm = {
  medicationName: "",
  dosage: "",
  reminderHour: 8,
  reminderMinute: 0,
  reminderTimes: [],
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
  intervalHours: null,
  startDate: getLocalDateStr(),
  endDate: "",
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
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">提醒时间</label>
          {formData.reminderTimes.length === 0 && (
            <button
              type="button"
              onClick={() => {
                // Switch to multi-time mode: add current time as first, then a new slot
                setFormData({
                  ...formData,
                  reminderTimes: [
                    { hour: formData.reminderHour, minute: formData.reminderMinute },
                    { hour: Math.min(formData.reminderHour + 8, 23), minute: formData.reminderMinute },
                  ],
                });
              }}
              className="text-xs text-terracotta hover:text-terracotta/80 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加多次服药
            </button>
          )}
        </div>
        {formData.reminderTimes.length === 0 ? (
          /* Single time mode */
          <TimePicker
            hour={formData.reminderHour}
            minute={formData.reminderMinute}
            onChange={(h, m) =>
              setFormData({ ...formData, reminderHour: h, reminderMinute: m })
            }
          />
        ) : (
          /* Multi-time mode */
          <div className="space-y-2">
            {formData.reminderTimes
              .map((t, i) => ({ ...t, originalIndex: i }))
              .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
              .map(({ hour, minute, originalIndex }) => (
              <div key={originalIndex} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0">第{formData.reminderTimes
                  .map((t, i) => ({ ...t, idx: i }))
                  .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                  .findIndex(t => t.idx === originalIndex) + 1}次</span>
                <div className="flex-1">
                  <TimePicker
                    hour={hour}
                    minute={minute}
                    onChange={(h, m) => {
                      const newTimes = [...formData.reminderTimes];
                      newTimes[originalIndex] = { hour: h, minute: m };
                      // Keep primary time synced with first sorted time
                      const sorted = [...newTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
                      setFormData({
                        ...formData,
                        reminderTimes: newTimes,
                        reminderHour: sorted[0].hour,
                        reminderMinute: sorted[0].minute,
                      });
                    }}
                  />
                </div>
                {formData.reminderTimes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTimes = formData.reminderTimes.filter((_, i) => i !== originalIndex);
                      if (newTimes.length <= 1) {
                        // Switch back to single time mode
                        const remaining = newTimes[0] || { hour: 8, minute: 0 };
                        setFormData({
                          ...formData,
                          reminderTimes: [],
                          reminderHour: remaining.hour,
                          reminderMinute: remaining.minute,
                        });
                      } else {
                        const sorted = [...newTimes].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
                        setFormData({
                          ...formData,
                          reminderTimes: newTimes,
                          reminderHour: sorted[0].hour,
                          reminderMinute: sorted[0].minute,
                        });
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const lastTime = formData.reminderTimes[formData.reminderTimes.length - 1];
                const nextHour = Math.min((lastTime?.hour ?? 8) + 6, 23);
                setFormData({
                  ...formData,
                  reminderTimes: [
                    ...formData.reminderTimes,
                    { hour: nextHour, minute: lastTime?.minute ?? 0 },
                  ],
                });
              }}
              className="text-xs text-terracotta hover:text-terracotta/80 flex items-center gap-1 py-1"
            >
              <Plus className="w-3 h-3" />
              添加时间点
            </button>
            <p className="text-xs text-muted-foreground">
              共 {formData.reminderTimes.length} 次/天
            </p>
          </div>
        )}
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
                onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                onBlur={() => { if (formData.stockQuantity === '') setFormData({ ...formData, stockQuantity: 0 }); }}
                className="h-8 text-sm mt-1"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">每日用量</label>
              <Input
                type="number"
                value={formData.dailyDosageCount}
                onChange={(e) => setFormData({ ...formData, dailyDosageCount: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })}
                onFocus={(e) => e.target.select()}
                onBlur={() => { if (formData.dailyDosageCount === '') setFormData({ ...formData, dailyDosageCount: 1 }); }}
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
                onChange={(e) => setFormData({ ...formData, stockAlertDays: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })}
                onFocus={(e) => e.target.select()}
                onBlur={() => { if (formData.stockAlertDays === '') setFormData({ ...formData, stockAlertDays: 1 }); }}
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
      {/* 用药起始/结束日期 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">用药日期</span>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">起始日期</label>
            <Input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="h-9 text-sm mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">结束日期 (可选)</label>
            <Input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="h-9 text-sm mt-1 w-full"
              min={formData.startDate || undefined}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">起始日期前不计入打卡；结束日期后自动归档</p>
      </div>
      {/* 药品有效期 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">有效期</span>
          <span className="text-xs text-muted-foreground">(可选)</span>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">过期日期</label>
            <Input
              type="date"
              value={formData.expirationDate}
              onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
              className="h-9 text-sm mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">提前提醒(天)</label>
            <Input
              type="number"
              value={formData.expirationAlertDays}
              onChange={(e) => setFormData({ ...formData, expirationAlertDays: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })}
              onFocus={(e) => e.target.select()}
              onBlur={() => { if (formData.expirationAlertDays === '') setFormData({ ...formData, expirationAlertDays: 30 }); }}
              className="h-9 text-sm mt-1 w-full"
              min={1}
              max={365}
            />
          </div>
        </div>
      </div>
      {/* 服药间隔模式 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">服药间隔</span>
          <span className="text-xs text-muted-foreground">(可选，如每8小时一次)</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.intervalHours !== null}
            onCheckedChange={(checked) => {
              setFormData({
                ...formData,
                intervalHours: checked ? 8 : null,
              });
            }}
          />
          <span className="text-xs text-muted-foreground">
            {formData.intervalHours !== null ? "已开启间隔提醒" : "关闭"}
          </span>
        </div>
        {formData.intervalHours !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">每</span>
            <Input
              type="number"
              value={formData.intervalHours}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  intervalHours: Math.max(1, Math.min(72, parseInt(e.target.value) || 8)),
                })
              }
              className="h-8 text-sm w-20"
              min={1}
              max={72}
            />
            <span className="text-xs text-muted-foreground">小时服用一次</span>
          </div>
        )}
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

  const formatTime = (h: number, m: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
          <p className="text-xs text-muted-foreground">使用上下箭头调整药品顺序，完成后点击“保存排序”。</p>
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
