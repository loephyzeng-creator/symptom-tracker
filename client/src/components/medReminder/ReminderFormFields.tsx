import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TimePicker from "@/components/TimePicker";
import {
  Plus, X, Package, CalendarPlus, FileText, ShieldAlert, Timer,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DaySelector from "./DaySelector";
import OffsetSelector from "./OffsetSelector";
import GroupSelector from "./GroupSelector";
import type { ReminderForm } from "./types";

export default function ReminderFormFields({
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
          <TimePicker
            hour={formData.reminderHour}
            minute={formData.reminderMinute}
            onChange={(h, m) =>
              setFormData({ ...formData, reminderHour: h, reminderMinute: m })
            }
          />
        ) : (
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
      <GroupSelector
        groupId={formData.groupId}
        onChange={(gId) => setFormData({ ...formData, groupId: gId })}
      />
      <div className="flex gap-2 pt-2">
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
