/**
 * Backup & Restore — complete data backup/restore with server-side API
 * v2: Exports all tables including medication reminders, groups, interactions, alerts, etc.
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Download, Upload, Shield, CheckCircle, AlertCircle, Loader2, Database,
} from "lucide-react";
import { toast } from "sonner";
import { getLocalDateStr } from "@shared/timezone";

export default function BackupRestore() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const restoreMutation = trpc.backup.restore.useMutation({
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.entriesRestored > 0) parts.push(`${result.entriesRestored} 条记录`);
      if (result.triggersRestored > 0) parts.push(`${result.triggersRestored} 个诱因`);
      if (result.remindersRestored > 0) parts.push(`${result.remindersRestored} 个用药提醒`);
      if (result.groupsRestored > 0) parts.push(`${result.groupsRestored} 个用药分组`);
      if (result.interactionsRestored > 0) parts.push(`${result.interactionsRestored} 条药物相互作用`);
      if (result.restocksRestored > 0) parts.push(`${result.restocksRestored} 条补货记录`);
      if (result.alertRulesRestored > 0) parts.push(`${result.alertRulesRestored} 条警报规则`);
      if (result.alertHistoryRestored > 0) parts.push(`${result.alertHistoryRestored} 条警报历史`);
      if (result.customMetricsRestored > 0) parts.push(`${result.customMetricsRestored} 个自定义指标`);
      if (result.customMetricValuesRestored > 0) parts.push(`${result.customMetricValuesRestored} 个指标值`);

      const summary = parts.length > 0 ? parts.join("，") : "数据已是最新，无需恢复";
      toast.success(`恢复成功：${summary}`);

      // Invalidate all queries to refresh data
      utils.entries.list.invalidate();
      utils.triggers.list.invalidate();
      utils.notification.getSettings.invalidate();
      utils.medications.history.invalidate();
      utils.medReminders.list.invalidate();
      utils.medGroups.list.invalidate();
      utils.drugInteractions.list.invalidate();
      utils.alerts.listRules.invalidate();
      utils.alerts.history.invalidate();
      setIsRestoring(false);
    },
    onError: (error) => {
      toast.error(`恢复失败：${error.message}`);
      setIsRestoring(false);
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await utils.backup.export.fetch();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `症状日记_完整备份_${getLocalDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const parts: string[] = [];
      parts.push(`${data.entries.length} 条记录`);
      if (data.medicationReminders?.length) parts.push(`${data.medicationReminders.length} 个用药提醒`);
      if (data.medicationGroups?.length) parts.push(`${data.medicationGroups.length} 个用药分组`);
      if (data.drugInteractions?.length) parts.push(`${data.drugInteractions.length} 条药物相互作用`);
      if (data.alertRules?.length) parts.push(`${data.alertRules.length} 条警报规则`);
      if (data.customMetrics?.length) parts.push(`${data.customMetrics.length} 个自定义指标`);
      if (data.customTriggers?.length) parts.push(`${data.customTriggers.length} 个自定义诱因`);

      setLastBackupInfo(parts.join("，"));
      toast.success("备份文件已下载");
    } catch (error: any) {
      toast.error(`备份失败：${error.message || "未知错误"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);

        // Validate basic structure
        if (!data || typeof data !== "object") {
          throw new Error("无效的备份文件格式");
        }

        // Support old format (array of entries), v1 format, and v2 format
        if (Array.isArray(data)) {
          // Old format: just an array of entries
          restoreMutation.mutate({ entries: data });
        } else {
          // v1/v2 format: pass all available fields
          restoreMutation.mutate({
            version: data.version,
            entries: data.entries,
            customTriggers: data.customTriggers,
            notificationSettings: data.notificationSettings,
            medicationGroups: data.medicationGroups,
            medicationReminders: data.medicationReminders,
            medicationRestocks: data.medicationRestocks,
            drugInteractions: data.drugInteractions,
            alertRules: data.alertRules,
            alertHistory: data.alertHistory,
            customMetrics: data.customMetrics,
            customMetricValues: data.customMetricValues,
          });
        }
      } catch (error: any) {
        toast.error(`文件解析失败：${error.message}`);
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border border-border/50 shadow-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center">
          <Database className="w-4 h-4 text-sage" />
        </div>
        <div>
          <h3 className="font-serif font-semibold text-sm">数据备份与恢复</h3>
          <p className="text-[10px] text-muted-foreground">
            完整备份包含所有记录、用药提醒、分组、警报规则等
          </p>
        </div>
      </div>

      {/* Backup */}
      <div className="space-y-2">
        <Button
          onClick={handleExport}
          disabled={isExporting}
          variant="outline"
          className="w-full rounded-lg h-10 text-sm justify-start gap-2"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-sage" />
          )}
          {isExporting ? "正在导出..." : "导出完整备份"}
        </Button>
        {lastBackupInfo && (
          <div className="flex items-center gap-1.5 text-[11px] text-sage">
            <CheckCircle className="w-3 h-3" />
            <span>已备份：{lastBackupInfo}</span>
          </div>
        )}
      </div>

      {/* Restore */}
      <div className="space-y-2">
        <Button
          onClick={handleRestoreClick}
          disabled={isRestoring}
          variant="outline"
          className="w-full rounded-lg h-10 text-sm justify-start gap-2"
        >
          {isRestoring ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 text-dusty-blue" />
          )}
          {isRestoring ? "正在恢复..." : "从备份文件恢复"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Info */}
      <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="w-3 h-3 mt-0.5 shrink-0" />
          <span>备份文件包含您的所有健康数据，请妥善保管</span>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>恢复时同名药品/同日期记录不会重复创建，已有数据不会被删除</span>
        </div>
      </div>
    </motion.div>
  );
}
