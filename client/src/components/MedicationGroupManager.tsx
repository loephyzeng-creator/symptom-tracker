import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FolderPlus,
  Folder,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Pill,
  CheckCircle2,
  Loader2,
  GripVertical,
  FolderOpen,
} from "lucide-react";

const GROUP_COLORS: { key: string; label: string; bg: string; text: string; border: string }[] = [
  { key: "sage", label: "鼠尾草", bg: "bg-[#87AE73]/15", text: "text-[#5B7A4A]", border: "border-[#87AE73]/30" },
  { key: "terracotta", label: "赤陶", bg: "bg-[#C67D5B]/15", text: "text-[#A05A3A]", border: "border-[#C67D5B]/30" },
  { key: "blue", label: "天蓝", bg: "bg-[#7BA7BC]/15", text: "text-[#4A7A8C]", border: "border-[#7BA7BC]/30" },
  { key: "purple", label: "紫藤", bg: "bg-[#9B8EC4]/15", text: "text-[#6B5E9E]", border: "border-[#9B8EC4]/30" },
  { key: "amber", label: "琥珀", bg: "bg-amber-100/60", text: "text-amber-700", border: "border-amber-200" },
  { key: "rose", label: "玫瑰", bg: "bg-rose-100/60", text: "text-rose-700", border: "border-rose-200" },
];

function getColorStyle(colorKey: string) {
  return GROUP_COLORS.find((c) => c.key === colorKey) ?? GROUP_COLORS[0];
}

interface GroupFormData {
  name: string;
  color: string;
}

const EMPTY_FORM: GroupFormData = { name: "", color: "sage" };

export default function MedicationGroupManager() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<GroupFormData>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<GroupFormData>({ ...EMPTY_FORM });
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [assigningReminderId, setAssigningReminderId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: grouped, isLoading } = trpc.medGroups.grouped.useQuery(undefined);
  const { data: groups = [] } = trpc.medGroups.list.useQuery(undefined);

  const createMutation = trpc.medGroups.create.useMutation({
    onSuccess: () => {
      utils.medGroups.grouped.invalidate();
      utils.medGroups.list.invalidate();
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      toast.success("药品分组已创建");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.medGroups.update.useMutation({
    onSuccess: () => {
      utils.medGroups.grouped.invalidate();
      utils.medGroups.list.invalidate();
      setEditingId(null);
      toast.success("分组已更新");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.medGroups.delete.useMutation({
    onSuccess: () => {
      utils.medGroups.grouped.invalidate();
      utils.medGroups.list.invalidate();
      utils.medReminders.list.invalidate();
      toast.success("分组已删除，药品已移至未分组");
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMutation = trpc.medGroups.assign.useMutation({
    onSuccess: () => {
      utils.medGroups.grouped.invalidate();
      utils.medReminders.list.invalidate();
      setAssigningReminderId(null);
      toast.success("药品已归组");
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmAllMutation = trpc.medGroups.confirmAll.useMutation({
    onSuccess: (result) => {
      utils.medGroups.grouped.invalidate();
      utils.medReminders.list.invalidate();
      utils.entries.list.invalidate();
      // Also invalidate today's medication check-in data
      utils.medReminders.checkInCalendar.invalidate();
      if (result.confirmed > 0) {
        toast.success(`已确认 ${result.confirmed} 种药品${result.skipped > 0 ? `，${result.skipped} 种已记录` : ""}`);
      } else {
        toast.info("所有药品今日已记录");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleExpand = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("请输入分组名称");
      return;
    }
    createMutation.mutate({ name: form.name.trim(), color: form.color });
  };

  const handleUpdate = () => {
    if (editingId === null || !editForm.name.trim()) return;
    updateMutation.mutate({ id: editingId, name: editForm.name.trim(), color: editForm.color });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`确定删除分组「${name}」？\n组内药品将移至"未分组"。`)) {
      deleteMutation.mutate({ id });
    }
  };

  const startEdit = (group: any) => {
    setEditingId(group.id);
    setEditForm({ name: group.name, color: group.color ?? "sage" });
  };

  if (isLoading) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
        加载中...
      </div>
    );
  }

  const groupList = grouped?.groups ?? [];
  const ungroupedList = grouped?.ungrouped ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-terracotta" />
          <h3 className="font-serif font-semibold text-foreground">药品分组</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="gap-1"
        >
          <FolderPlus className="w-4 h-4" />
          新建分组
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        将药品归入分组（如"早晨药组""晚间药组"），方便批量管理和一键确认服药。
      </p>

      {/* Create form */}
      {showCreate && (
        <div className="border border-border/50 rounded-xl p-3 space-y-3 bg-card">
          <Input
            placeholder="分组名称，如：早晨药组"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-9 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">颜色：</span>
            {GROUP_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => setForm({ ...form, color: c.key })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${c.bg} ${
                  form.color === c.key ? `${c.border} ring-2 ring-offset-1 ring-current ${c.text}` : "border-transparent"
                }`}
                title={c.label}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="bg-terracotta hover:bg-terracotta/90 text-white"
            >
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                setForm({ ...EMPTY_FORM });
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* Group list */}
      {groupList.length === 0 && ungroupedList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无分组</p>
          <p className="text-xs mt-1">点击"新建分组"开始管理药品</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupList.map((group: any) => {
            const colorStyle = getColorStyle(group.color ?? "sage");
            const isExpanded = expandedGroups.has(group.id);
            const medCount = group.medications?.length ?? 0;

            return (
              <div
                key={group.id}
                className={`border rounded-xl overflow-hidden transition-all ${colorStyle.border}`}
              >
                {/* Group header */}
                {editingId === group.id ? (
                  <div className="p-3 space-y-2 bg-card">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">颜色：</span>
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c.key}
                          onClick={() => setEditForm({ ...editForm, color: c.key })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${c.bg} ${
                            editForm.color === c.key
                              ? `${c.border} ring-2 ring-offset-1 ring-current ${c.text}`
                              : "border-transparent"
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleUpdate}
                        disabled={updateMutation.isPending}
                        className="bg-terracotta hover:bg-terracotta/90 text-white h-7 text-xs"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        保存
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="h-7 text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-2 p-3 cursor-pointer ${colorStyle.bg}`}
                    onClick={() => toggleExpand(group.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className={`w-4 h-4 ${colorStyle.text}`} />
                    ) : (
                      <ChevronRight className={`w-4 h-4 ${colorStyle.text}`} />
                    )}
                    <Folder className={`w-4 h-4 ${colorStyle.text}`} />
                    <span className={`font-medium text-sm ${colorStyle.text}`}>
                      {group.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({medCount}种药品)
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      {medCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs gap-1 ${colorStyle.text} hover:${colorStyle.bg}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAllMutation.mutate({ groupId: group.id });
                          }}
                          disabled={confirmAllMutation.isPending}
                          title="一键确认本组所有药品已服用"
                        >
                          {confirmAllMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          一键确认
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(group);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(group.id, group.name);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Group medications */}
                {isExpanded && editingId !== group.id && (
                  <div className="border-t border-border/30">
                    {medCount === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        暂无药品，请在用药提醒中将药品归入此分组
                      </div>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {group.medications.map((med: any) => (
                          <div
                            key={med.id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
                          >
                            <Pill className="w-3.5 h-3.5 text-terracotta shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">
                                {med.medicationName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {med.dosage} · {String(med.reminderHour).padStart(2, "0")}:
                                {String(med.reminderMinute).padStart(2, "0")}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                assignMutation.mutate({
                                  reminderId: med.id,
                                  groupId: null,
                                })
                              }
                              disabled={assignMutation.isPending}
                            >
                              移出
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ungrouped medications */}
          {ungroupedList.length > 0 && (
            <div className="border border-border/30 rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-2 p-3 bg-muted/30 cursor-pointer"
                onClick={() => toggleExpand(-1)}
              >
                {expandedGroups.has(-1) ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm text-muted-foreground">
                  未分组
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({ungroupedList.length}种药品)
                </span>
              </div>

              {expandedGroups.has(-1) && (
                <div className="border-t border-border/20 divide-y divide-border/20">
                  {ungroupedList.map((med: any) => (
                    <div
                      key={med.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <Pill className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {med.medicationName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {med.dosage} · {String(med.reminderHour).padStart(2, "0")}:
                          {String(med.reminderMinute).padStart(2, "0")}
                        </p>
                      </div>
                      {/* Assign to group dropdown */}
                      {assigningReminderId === med.id ? (
                        <div className="flex items-center gap-1">
                          {groups.map((g: any) => {
                            const cs = getColorStyle(g.color ?? "sage");
                            return (
                              <button
                                key={g.id}
                                onClick={() =>
                                  assignMutation.mutate({
                                    reminderId: med.id,
                                    groupId: g.id,
                                  })
                                }
                                className={`text-xs px-2 py-1 rounded-full ${cs.bg} ${cs.text} ${cs.border} border hover:opacity-80 transition-opacity`}
                                disabled={assignMutation.isPending}
                              >
                                {g.name}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setAssigningReminderId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        groups.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            onClick={() => setAssigningReminderId(med.id)}
                          >
                            归组
                          </Button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
