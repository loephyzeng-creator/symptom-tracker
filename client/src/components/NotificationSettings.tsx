import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, BellOff, Clock, Loader2, Check, BellRing, AlertTriangle, Globe } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { TIMEZONE_OPTIONS, getBrowserTimezone } from "@shared/timezone";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Get VAPID public key from env
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

/**
 * Convert a base64 string to a Uint8Array for applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushStatus = "loading" | "unsupported" | "denied" | "not-subscribed" | "subscribed";

export default function NotificationSettings() {
  const { data: settings, isLoading } = trpc.notification.getSettings.useQuery();
  const updateMutation = trpc.notification.updateSettings.useMutation();
  const subscribeMutation = trpc.notification.subscribe.useMutation();
  const unsubscribeMutation = trpc.notification.unsubscribe.useMutation();
  const utils = trpc.useUtils();

  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("loading");
  const [subscribing, setSubscribing] = useState(false);
  const [timezone, setTimezone] = useState(getBrowserTimezone());

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled === 1);
      setHour(settings.reminderHour);
      setMinute(settings.reminderMinute);
      if (settings.timezone) {
        setTimezone(settings.timezone);
      }
    }
  }, [settings]);

  // Check push notification support and current status
  const checkPushStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setPushStatus("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushStatus(subscription ? "subscribed" : "not-subscribed");
    } catch {
      setPushStatus("not-subscribed");
    }
  }, []);

  useEffect(() => {
    checkPushStatus();
  }, [checkPushStatus]);

  const handleSubscribe = async () => {
    if (!VAPID_PUBLIC_KEY) {
      toast.error("推送服务未配置");
      return;
    }

    setSubscribing(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("denied");
        toast.error("通知权限被拒绝，请在浏览器设置中允许通知");
        setSubscribing(false);
        return;
      }

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = subscription.toJSON();

      // Save subscription to server
      await subscribeMutation.mutateAsync({
        endpoint: subJson.endpoint!,
        keys: {
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
      });

      setPushStatus("subscribed");
      utils.notification.getSettings.invalidate();
      toast.success("推送通知已开启");
    } catch (error: any) {
      console.error("Push subscription failed:", error);
      toast.error("开启推送失败，请重试");
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    setSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from server
        await unsubscribeMutation.mutateAsync({ endpoint });
      }

      setPushStatus("not-subscribed");
      utils.notification.getSettings.invalidate();
      toast.success("推送通知已关闭");
    } catch (error) {
      console.error("Push unsubscribe failed:", error);
      toast.error("关闭推送失败，请重试");
    } finally {
      setSubscribing(false);
    }
  };

  const handleTimezoneChange = (newTz: string) => {
    setTimezone(newTz);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        enabled: enabled ? 1 : 0,
        reminderHour: hour,
        reminderMinute: minute,
        timezone,
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
      {/* Push Notification Status Card */}
      <div className="bg-card rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BellRing className="w-4 h-4 text-terracotta" />
          <p className="text-sm font-semibold text-foreground">浏览器推送通知</p>
        </div>

        {pushStatus === "loading" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>检查推送状态...</span>
          </div>
        )}

        {pushStatus === "unsupported" && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <p className="font-medium mb-1">当前浏览器不支持推送通知</p>
              <p>iOS 用户请先将网站「添加到主屏幕」（需 iOS 16.4+），然后从主屏幕图标打开即可支持推送。</p>
            </div>
          </div>
        )}

        {pushStatus === "denied" && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
              <p className="font-medium mb-1">通知权限已被拒绝</p>
              <p>请在浏览器设置中重新允许本网站的通知权限，然后刷新页面。</p>
            </div>
          </div>
        )}

        {pushStatus === "not-subscribed" && (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              开启后，即使关闭网页也能收到提醒通知。
            </p>
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta/90 text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {subscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              开启推送通知
            </button>
          </div>
        )}

        {pushStatus === "subscribed" && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">推送通知已开启</span>
            </div>
            <button
              onClick={handleUnsubscribe}
              disabled={subscribing}
              className="w-full flex items-center justify-center gap-2 bg-muted/50 hover:bg-muted text-muted-foreground rounded-xl py-2.5 text-xs transition-colors disabled:opacity-50"
            >
              {subscribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <BellOff className="w-3.5 h-3.5" />
              )}
              关闭推送通知
            </button>
          </div>
        )}
      </div>

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
            每天 {getTimeLabel(hour)} {formatTime(hour, minute)}，如果还没有记录，系统会推送通知提醒你
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

      {/* Timezone Selector */}
      <div className="bg-card rounded-2xl border border-border/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-terracotta" />
          <p className="text-sm font-semibold text-foreground">时区设置</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          提醒推送和日期计算将按照所选时区执行。切换时区后，用药提醒时间会自动适配。
        </p>
        <select
          value={timezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          className="w-full bg-muted/50 border border-border/30 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/30 transition-colors"
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        {timezone !== getBrowserTimezone() && (
          <button
            onClick={() => handleTimezoneChange(getBrowserTimezone())}
            className="mt-2 text-xs text-terracotta hover:text-terracotta/80 transition-colors"
          >
            ← 使用浏览器时区 ({TIMEZONE_OPTIONS.find(o => o.value === getBrowserTimezone())?.label || getBrowserTimezone()})
          </button>
        )}
      </div>

      {/* Info note */}
      <div className="bg-sage/10 rounded-xl p-3 border border-sage/20">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {pushStatus === "subscribed"
            ? "推送通知已开启，即使关闭网页也能收到提醒。iOS 用户需从主屏幕图标打开应用才能收到推送。"
            : "开启浏览器推送通知后，即使关闭网页也能收到每日提醒。iOS 用户需先将网站添加到主屏幕（需 iOS 16.4+）。"}
        </p>
      </div>
    </div>
  );
}
