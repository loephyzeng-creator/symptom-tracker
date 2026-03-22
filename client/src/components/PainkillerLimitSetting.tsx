/**
 * PainkillerLimitSetting — allows user to configure the painkiller day limit
 * (max days of painkiller usage within a 30-day window before warning),
 * toggle push notification alerts, and customize weekly report frequency/time.
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Pill, Check, Loader2, Info, Bell, BellOff, CalendarClock, Clock, Volume2 } from "lucide-react";
import { toast } from "sonner";

const FREQUENCY_OPTIONS = [
  { value: "daily" as const, label: "每日", desc: "每天推送" },
  { value: "weekly" as const, label: "每周", desc: "每周日推送" },
  { value: "biweekly" as const, label: "每两周", desc: "隔周日推送" },
  { value: "monthly" as const, label: "每月", desc: "每月1日推送" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00`,
}));

export default function PainkillerLimitSetting() {
  const settings = trpc.notification.getSettings.useQuery();
  const updateLimit = trpc.notification.updatePainkillerLimit.useMutation();
  const updateAlertEnabled = trpc.notification.updatePainkillerAlertEnabled.useMutation();
  const updateFrequency = trpc.notification.updateWeeklyReportFrequency.useMutation();
  const updateReportHour = trpc.notification.updateWeeklyReportHour.useMutation();
  const updateSound = trpc.notification.updateNotificationSound.useMutation();
  const utils = trpc.useUtils();

  const currentLimit = (settings.data as any)?.painkillerDayLimit ?? 10;
  const currentAlertEnabled = (settings.data as any)?.painkillerAlertEnabled === 1;
  const currentFrequency = (settings.data as any)?.weeklyReportFrequency ?? "weekly";
  const currentReportHour = (settings.data as any)?.weeklyReportHour ?? 19;
  const currentSound = (settings.data as any)?.notificationSound ?? "default";
  const [localLimit, setLocalLimit] = useState(10);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setLocalLimit((settings.data as any)?.painkillerDayLimit ?? 10);
    }
  }, [settings.data]);

  const handleSave = async () => {
    try {
      await updateLimit.mutateAsync({ limit: localLimit });
      utils.notification.getSettings.invalidate();
      utils.entries.painkillerUsage.invalidate();
      setDirty(false);
      toast.success("止疼药阈值已更新", {
        description: `30天内用量上限设为 ${localLimit} 天`,
      });
    } catch {
      toast.error("保存失败，请重试");
    }
  };

  const handleToggleAlert = async (enabled: boolean) => {
    try {
      await updateAlertEnabled.mutateAsync({ enabled });
      utils.notification.getSettings.invalidate();
      toast.success(enabled ? "止疼药阈值通知已开启" : "止疼药阈值通知已关闭", {
        description: enabled
          ? "当用量接近或超过阈值时，将推送通知到您的手机"
          : "将不再推送止疼药阈值提醒",
      });
    } catch {
      toast.error("设置失败，请重试");
    }
  };

  const handleFrequencyChange = async (frequency: "daily" | "weekly" | "biweekly" | "monthly") => {
    try {
      await updateFrequency.mutateAsync({ frequency });
      utils.notification.getSettings.invalidate();
      const label = FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label ?? frequency;
      toast.success(`报告频率已改为${label}`);
    } catch {
      toast.error("设置失败，请重试");
    }
  };

  const handleReportHourChange = async (hour: number) => {
    try {
      await updateReportHour.mutateAsync({ hour });
      utils.notification.getSettings.invalidate();
      toast.success(`周报推送时间已改为 ${String(hour).padStart(2, "0")}:00`);
    } catch {
      toast.error("设置失败，请重试");
    }
  };

  if (settings.isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/30">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          设置30天内服用止疼药的天数上限。当累计天数接近或超过此值时，记录页面会显示警告提醒。
        </p>
      </div>

      {/* Push notification toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            currentAlertEnabled
              ? "bg-terracotta/10"
              : "bg-muted/50"
          }`}>
            {currentAlertEnabled ? (
              <Bell className="w-4 h-4 text-terracotta" />
            ) : (
              <BellOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">推送通知提醒</p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {currentAlertEnabled
                ? "接近阈值70%或超限时推送到手机"
                : "已关闭推送通知"}
            </p>
          </div>
        </div>
        <Switch
          checked={currentAlertEnabled}
          onCheckedChange={handleToggleAlert}
          disabled={updateAlertEnabled.isPending}
        />
      </div>

      {/* Weekly report frequency */}
      <div className="p-3 rounded-lg border border-border/30 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-dusty-blue" />
          <span className="text-sm font-medium">报告推送频率</span>
        </div>
        <div className="flex gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFrequencyChange(opt.value)}
              disabled={updateFrequency.isPending}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                currentFrequency === opt.value
                  ? "bg-dusty-blue/10 text-dusty-blue border-dusty-blue/30"
                  : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div>{opt.label}</div>
              <div className="text-[9px] mt-0.5 opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* Report hour selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">推送时间</span>
          </div>
          <select
            value={currentReportHour}
            onChange={(e) => handleReportHourChange(Number(e.target.value))}
            disabled={updateReportHour.isPending}
            className="text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-dusty-blue/50"
          >
            {HOUR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification sound preference */}
      <div className="p-3 rounded-lg border border-border/30 bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-sage-green" />
          <span className="text-sm font-medium">提醒铃声</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {([
            { value: "default" as const, label: "默认", desc: "系统铃声" },
            { value: "gentle" as const, label: "柔和", desc: "轻柔提示" },
            { value: "urgent" as const, label: "紧急", desc: "强提醒" },
            { value: "silent" as const, label: "静音", desc: "仅横幅" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={async () => {
                try {
                  await updateSound.mutateAsync({ sound: opt.value });
                  utils.notification.getSettings.invalidate();
                  toast.success(`提醒铃声已设为「${opt.label}」`);
                } catch {
                  toast.error("设置失败，请重试");
                }
              }}
              disabled={updateSound.isPending}
              className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                currentSound === opt.value
                  ? "bg-sage-green/10 text-sage-green border-sage-green/30"
                  : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div>{opt.label}</div>
              <div className="text-[9px] mt-0.5 opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          注意：Web Push 通知的实际铃声受浏览器和系统设置影响，“静音”模式会尽量静音推送。
        </p>
      </div>

      {/* Current value display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-chart-4/10 flex items-center justify-center">
            <Pill className="w-3.5 h-3.5 text-chart-4" />
          </div>
          <span className="text-sm font-medium">报警阈值</span>
        </div>
        <span className={`text-lg font-bold tabular-nums ${
          localLimit <= 5 ? "text-destructive" : localLimit <= 8 ? "text-terracotta" : "text-foreground"
        }`}>
          {localLimit} <span className="text-xs font-normal text-muted-foreground">天 / 30天</span>
        </span>
      </div>

      {/* Slider */}
      <div className="px-1">
        <Slider
          value={[localLimit]}
          onValueChange={(v) => {
            setLocalLimit(v[0]);
            setDirty(v[0] !== currentLimit);
          }}
          min={1}
          max={30}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">1天</span>
          <span className="text-[10px] text-muted-foreground">30天</span>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2">
        {[5, 8, 10, 15].map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setLocalLimit(preset);
              setDirty(preset !== currentLimit);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              localLimit === preset
                ? "bg-terracotta/10 text-terracotta border-terracotta/30"
                : "bg-card border-border/50 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {preset}天
          </button>
        ))}
      </div>

      {/* Save button */}
      {dirty && (
        <Button
          onClick={handleSave}
          disabled={updateLimit.isPending}
          className="w-full bg-terracotta hover:bg-terracotta/90 text-white"
          size="sm"
        >
          {updateLimit.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              保存设置
            </>
          )}
        </Button>
      )}
    </div>
  );
}
