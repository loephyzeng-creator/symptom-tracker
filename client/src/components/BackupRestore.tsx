/**
 * Backup & Restore — complete data backup/restore with server-side API
 * v2: Exports all tables including medication reminders, groups, interactions, alerts, etc.
 * Features:
 *   - Backup reminder when last backup > 7 days ago
 *   - Import preview dialog showing data summary before confirming restore
 */
import { useState, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Upload, Shield, CheckCircle, AlertCircle, Loader2, Database,
  Clock, X, FileText, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getLocalDateStr } from "@shared/timezone";

/** Helper: build human-readable summary parts from backup data */
function buildSummaryParts(data: any): string[] {
  const parts: string[] = [];
  if (data.entries?.length) parts.push(`${data.entries.length} 条症状记录`);
  if (data.medicationReminders?.length) parts.push(`${data.medicationReminders.length} 个用药提醒`);
  if (data.medicationGroups?.length) parts.push(`${data.medicationGroups.length} 个用药分组`);
  if (data.drugInteractions?.length) parts.push(`${data.drugInteractions.length} 条药物相互作用`);
  if (data.medicationRestocks?.length) parts.push(`${data.medicationRestocks.length} 条补货记录`);
  if (data.alertRules?.length) parts.push(`${data.alertRules.length} 条警报规则`);
  if (data.alertHistory?.length) parts.push(`${data.alertHistory.length} 条警报历史`);
  if (data.customMetrics?.length) parts.push(`${data.customMetrics.length} 个自定义指标`);
  if (data.customMetricValues?.length) parts.push(`${data.customMetricValues.length} 个指标值`);
  if (data.customTriggers?.length) parts.push(`${data.customTriggers.length} 个自定义诱因`);
  if (data.notificationSettings) parts.push("通知设置");
  return parts;
}

/** Helper: format relative time in Chinese */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

// ── Import Preview Dialog ──
interface ImportPreviewProps {
  data: any;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isRestoring: boolean;
}

function ImportPreviewDialog({ data, fileName, onConfirm, onCancel, isRestoring }: ImportPreviewProps) {
  const isOldFormat = Array.isArray(data);
  const summaryParts = isOldFormat
    ? [`${data.length} 条症状记录`]
    : buildSummaryParts(data);

  const version = isOldFormat ? "旧版" : data.version === 2 ? "v2" : "v1";
  const exportedAt = !isOldFormat && data.exportedAt
    ? new Date(data.exportedAt).toLocaleString("zh-CN")
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-card rounded-2xl border border-border/50 shadow-xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-dusty-blue/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-dusty-blue" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-sm">确认恢复数据</h3>
              <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{fileName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg hover:bg-muted/50 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3">
          {/* Format & Date info */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="bg-muted/60 px-2 py-0.5 rounded-full">格式：{version}</span>
            {exportedAt && <span>导出于 {exportedAt}</span>}
          </div>

          {/* Data summary */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground mb-2">此文件包含：</p>
            {summaryParts.length > 0 ? (
              <div className="grid grid-cols-1 gap-1">
                {summaryParts.map((part, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-foreground/80">
                    <CheckCircle className="w-3 h-3 text-sage shrink-0" />
                    <span>{part}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">文件中没有可识别的数据</p>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>同名药品/同日期记录不会重复创建，已有数据不会被删除</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isRestoring}
            className="flex-1 rounded-lg h-9 text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isRestoring || summaryParts.length === 0}
            className="flex-1 rounded-lg h-9 text-xs bg-dusty-blue hover:bg-dusty-blue/90 text-white"
          >
            {isRestoring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                恢复中...
              </>
            ) : (
              "确认恢复"
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ──
export default function BackupRestore() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Query last backup time
  const { data: backupTimeData } = trpc.backup.lastBackupTime.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Calculate if backup reminder should show
  const backupReminder = useMemo(() => {
    if (!backupTimeData) return null;
    const { lastBackupAt } = backupTimeData;
    if (!lastBackupAt) {
      return { show: true, message: "您还没有备份过数据", severity: "warning" as const };
    }
    const lastDate = new Date(lastBackupAt);
    const diffMs = Date.now() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 7) {
      return {
        show: true,
        message: `上次备份：${formatRelativeTime(lastDate)}`,
        severity: diffDays >= 30 ? "warning" as const : "info" as const,
      };
    }
    return { show: false, message: `上次备份：${formatRelativeTime(lastDate)}`, severity: "ok" as const };
  }, [backupTimeData]);

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
      setPreviewData(null);
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

      const parts = buildSummaryParts(data);
      setLastBackupInfo(parts.join("，"));
      toast.success("备份文件已下载", {
        description: `已导出：${parts.join("、")}`,
      });

      // Refresh backup time query
      utils.backup.lastBackupTime.invalidate();
    } catch (error: any) {
      toast.error(`备份失败：${error.message || "未知错误"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  // Parse file and show preview instead of immediately restoring
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const data = JSON.parse(text);

        // Validate basic structure
        if (!data || typeof data !== "object") {
          throw new Error("无效的备份文件格式");
        }

        // Show preview dialog
        setPreviewData(data);
        setPreviewFileName(file.name);
      } catch (error: any) {
        toast.error(`文件解析失败：${error.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Confirm restore from preview
  const handleConfirmRestore = () => {
    if (!previewData) return;
    setIsRestoring(true);

    if (Array.isArray(previewData)) {
      restoreMutation.mutate({ entries: previewData });
    } else {
      restoreMutation.mutate({
        version: previewData.version,
        entries: previewData.entries,
        customTriggers: previewData.customTriggers,
        notificationSettings: previewData.notificationSettings,
        medicationGroups: previewData.medicationGroups,
        medicationReminders: previewData.medicationReminders,
        medicationRestocks: previewData.medicationRestocks,
        drugInteractions: previewData.drugInteractions,
        alertRules: previewData.alertRules,
        alertHistory: previewData.alertHistory,
        customMetrics: previewData.customMetrics,
        customMetricValues: previewData.customMetricValues,
      });
    }
  };

  const handleCancelRestore = () => {
    setPreviewData(null);
    setPreviewFileName("");
  };

  return (
    <>
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

        {/* Backup Reminder Banner */}
        {backupReminder?.show && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={`rounded-lg p-3 flex items-start gap-2 ${
              backupReminder.severity === "warning"
                ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40"
                : "bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40"
            }`}
          >
            <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
              backupReminder.severity === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : "text-blue-600 dark:text-blue-400"
            }`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${
                backupReminder.severity === "warning"
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-blue-800 dark:text-blue-300"
              }`}>
                {backupReminder.severity === "warning" ? "建议尽快备份" : "建议定期备份"}
              </p>
              <p className={`text-[11px] mt-0.5 ${
                backupReminder.severity === "warning"
                  ? "text-amber-700/80 dark:text-amber-400/80"
                  : "text-blue-700/80 dark:text-blue-400/80"
              }`}>
                {backupReminder.message}，建议每周备份一次以防数据丢失
              </p>
            </div>
          </motion.div>
        )}

        {/* Last backup info (when not showing reminder) */}
        {backupReminder && !backupReminder.show && backupReminder.message && (
          <div className="flex items-center gap-1.5 text-[11px] text-sage">
            <Clock className="w-3 h-3" />
            <span>{backupReminder.message}</span>
          </div>
        )}

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

      {/* Import Preview Dialog */}
      <AnimatePresence>
        {previewData && (
          <ImportPreviewDialog
            data={previewData}
            fileName={previewFileName}
            onConfirm={handleConfirmRestore}
            onCancel={handleCancelRestore}
            isRestoring={isRestoring}
          />
        )}
      </AnimatePresence>
    </>
  );
}
