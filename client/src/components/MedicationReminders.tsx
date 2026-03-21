import { useState, useMemo } from "react";
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
} from "lucide-react";

interface ReminderForm {
  medicationName: string;
  dosage: string;
  reminderHour: number;
  reminderMinute: number;
}

const EMPTY_FORM: ReminderForm = {
  medicationName: "",
  dosage: "",
  reminderHour: 8,
  reminderMinute: 0,
};

export default function MedicationReminders() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<ReminderForm>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ReminderForm>({ ...EMPTY_FORM });

  const utils = trpc.useUtils();
  const { data: reminders = [], isLoading } = trpc.medReminders.list.useQuery(undefined);
  const { data: medHistory = [] } = trpc.medications.history.useQuery(undefined);

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
    addMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!editForm.medicationName.trim() || !editForm.dosage.trim()) {
      toast.error("请填写药品名称和剂量");
      return;
    }
    if (editingId === null) return;
    updateMutation.mutate({ id: editingId, ...editForm });
  };

  const startEdit = (reminder: any) => {
    setEditingId(reminder.id);
    setEditForm({
      medicationName: reminder.medicationName,
      dosage: reminder.dosage,
      reminderHour: reminder.reminderHour,
      reminderMinute: reminder.reminderMinute,
    });
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

  const TimeInput = ({
    hour,
    minute,
    onChange,
  }: {
    hour: number;
    minute: number;
    onChange: (h: number, m: number) => void;
  }) => (
    <div className="flex items-center gap-1">
      <Clock className="w-4 h-4 text-muted-foreground" />
      <input
        type="time"
        value={formatTime(hour, minute)}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          onChange(h, m);
        }}
        className="bg-transparent border border-border rounded-md px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-terracotta"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-terracotta" />
          <h3 className="font-serif font-semibold text-foreground">用药提醒</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          添加
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        为每种药品设置独立的提醒时间和剂量，到时间自动推送通知。
      </p>

      {/* Add form */}
      {showAdd && (
        <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">药品名称</label>
            <Input
              value={form.medicationName}
              onChange={(e) =>
                setForm({ ...form, medicationName: e.target.value })
              }
              placeholder="输入药品名称"
              list="med-suggestions-add"
            />
            <datalist id="med-suggestions-add">
              {medSuggestions.map((name: string, i: number) => (
                <option key={i} value={name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">剂量</label>
            <Input
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
              placeholder="如：10mg、1片、2粒"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">提醒时间</label>
            <TimeInput
              hour={form.reminderHour}
              minute={form.reminderMinute}
              onChange={(h, m) =>
                setForm({ ...form, reminderHour: h, reminderMinute: m })
              }
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="bg-terracotta hover:bg-terracotta/90 text-white"
            >
              {addMutation.isPending ? "添加中..." : "确认添加"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAdd(false);
                setForm({ ...EMPTY_FORM });
              }}
            >
              取消
            </Button>
          </div>
        </div>
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
                <div
                  key={reminder.id}
                  className={`bg-card border rounded-xl p-3 transition-all ${
                    reminder.enabled
                      ? "border-border/50"
                      : "border-border/30 opacity-60"
                  }`}
                >
                  {editingId === reminder.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <Input
                        value={editForm.medicationName}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            medicationName: e.target.value,
                          })
                        }
                        placeholder="药品名称"
                        list="med-suggestions-edit"
                      />
                      <datalist id="med-suggestions-edit">
                        {medSuggestions.map((name: string, i: number) => (
                          <option key={i} value={name} />
                        ))}
                      </datalist>
                      <div className="flex gap-2">
                        <Input
                          value={editForm.dosage}
                          onChange={(e) =>
                            setEditForm({ ...editForm, dosage: e.target.value })
                          }
                          placeholder="剂量"
                          className="flex-1"
                        />
                        <TimeInput
                          hour={editForm.reminderHour}
                          minute={editForm.reminderMinute}
                          onChange={(h, m) =>
                            setEditForm({
                              ...editForm,
                              reminderHour: h,
                              reminderMinute: m,
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdate}
                          disabled={updateMutation.isPending}
                          className="gap-1 bg-terracotta hover:bg-terracotta/90 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                          保存
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Pill className="w-4 h-4 text-terracotta shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">
                            {reminder.medicationName}
                          </p>
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
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("确定删除此用药提醒？")) {
                              deleteMutation.mutate({ id: reminder.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
