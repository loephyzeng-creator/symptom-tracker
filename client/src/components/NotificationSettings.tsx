import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, Clock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function NotificationSettings() {
  const { data: settings, isLoading } = trpc.notification.getSettings.useQuery();
  const updateMutation = trpc.notification.updateSettings.useMutation();
  const utils = trpc.useUtils();

  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled === 1);
      setHour(settings.reminderHour);
      setMinute(settings.reminderMinute);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        enabled: enabled ? 1 : 0,
        reminderHour: hour,
        reminderMinute: minute,
      });
      utils.notification.getSettings.invalidate();
      setHasChanges(false);
      toast.success(enabled ? "提醒已开启" : "提醒已关闭");
    } catch {
      toast.error("保存失败，请重试");
    }
  };

  const handleToggle = () => {
    setEnabled(!enabled);
    setHasChanges(true);
  };

  const handleHourChange = (newHour: number) => {
    setHour(newHour);
    setHasChanges(true);
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
    setHasChanges(true);
  };

  const formatTime = (h: number, m: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const getTimeLabel = (h: number) => {
    if (h < 6) return "凌晨";
    if (h < 9) return "早上";
    if (h < 12) return "上午";
    if (h < 14) return "中午";
    if (h < 18) return "下午";
    if (h < 22) return "晚上";
    return "深夜";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-terracotta" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle Card */}
      <div className="bg-card rounded-2xl border border-border/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                enabled ? "bg-terracotta/15" : "bg-muted"
              }`}
            >
              {enabled ? (
                <Bell className="w-4.5 h-4.5 text-terracotta" />
              ) : (
                <BellOff className="w-4.5 h-4.5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">每日提醒</p>
              <p className="text-[11px] text-muted-foreground">
                {enabled ? "当天未记录时推送提醒" : "提醒已关闭"}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              enabled ? "bg-terracotta" : "bg-muted-foreground/20"
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm"
              animate={{ left: enabled ? "calc(100% - 1.625rem)" : "0.125rem" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* Time Picker - only show when enabled */}
      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-card rounded-2xl border border-border/30 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-terracotta" />
            <p className="text-sm font-semibold text-foreground">提醒时间</p>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            每天 {getTimeLabel(hour)} {formatTime(hour, minute)}，如果还没有记录，系统会推送消息提醒你
          </p>

          {/* Hour selector */}
          <div className="mb-3">
            <p className="text-[11px] text-muted-foreground mb-2">小时</p>
            <div className="grid grid-cols-6 gap-1.5">
              {HOURS.map((h) => (
                <button
                  key={h}
                  onClick={() => handleHourChange(h)}
                  className={`text-xs py-1.5 rounded-lg transition-all ${
                    h === hour
                      ? "bg-terracotta text-white font-semibold"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* Minute selector */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-2">分钟</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 15, 30, 45].map((m) => (
                <button
                  key={m}
                  onClick={() => handleMinuteChange(m)}
                  className={`text-xs py-1.5 rounded-lg transition-all ${
                    m === minute
                      ? "bg-terracotta text-white font-semibold"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Save button */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta/90 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            保存设置
          </button>
        </motion.div>
      )}

      {/* Info note */}
      <div className="bg-sage/10 rounded-xl p-3 border border-sage/20">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          提醒通知会通过 Manus 系统消息推送。请确保已允许 Manus 的通知权限，以便及时收到提醒。
        </p>
      </div>
    </div>
  );
}
