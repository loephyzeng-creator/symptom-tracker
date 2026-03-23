/**
 * Backup & Restore — complete data backup/restore using localStorage
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Download, Upload, Shield, CheckCircle, AlertCircle, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { getLocalDateStr } from "@shared/timezone";
import { getEntries, saveEntries, upsertEntry, getTriggers, saveTriggers } from "@/lib/local-storage";

export default function BackupRestore() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const entries = getEntries();
      const customTriggers = getTriggers();
      const data = { version: "2.0", exportedAt: new Date().toISOString(), entries, customTriggers };
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `症状日记_完整备份_${getLocalDateStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastBackupInfo(`${entries.length} 条记录，${customTriggers.length} 个自定义诱因`);
      toast.success("备份文件已下载");
    } catch (error: any) {
      toast.error(`备份失败：${error.message || "未知错误"}`);
    } finally {
      setIsExporting(false);
    }
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
        if (!data || typeof data !== "object") throw new Error("无效的备份文件格式");
        let entriesRestored = 0;
        let triggersRestored = 0;
        const entriesToRestore = Array.isArray(data) ? data : (data.entries || []);
        for (const entry of entriesToRestore) {
          if (entry && entry.date) { upsertEntry(entry); entriesRestored++; }
        }
        if (!Array.isArray(data) && data.customTriggers) {
          const existing = getTriggers().map((t) => t.name);
          for (const trigger of data.customTriggers) {
            const name = typeof trigger === "string" ? trigger : trigger.name;
            if (name && !existing.includes(name)) { saveTriggers(name); triggersRestored++; }
          }
        }
        toast.success(`恢复成功：${entriesRestored} 条记录，${triggersRestored} 个自定义诱因`);
        setTimeout(() => window.location.reload(), 1000);
      } catch (error: any) {
        toast.error(`文件解析失败：${error.message}`);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center">
          <Database className="w-4 h-4 text-sage" />
        </div>
        <div>
          <h3 className="font-serif font-semibold text-sm">数据备份与恢复</h3>
          <p className="text-[10px] text-muted-foreground">备份包含所有记录和自定义诱因</p>
        </div>
      </div>
      <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full rounded-lg h-10 text-sm justify-start gap-2">
        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-sage" />}
        {isExporting ? "正在导出..." : "导出完整备份"}
      </Button>
      {lastBackupInfo && (
        <div className="flex items-center gap-1.5 text-[11px] text-sage">
          <CheckCircle className="w-3 h-3" /><span>已备份：{lastBackupInfo}</span>
        </div>
      )}
      <Button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} variant="outline" className="w-full rounded-lg h-10 text-sm justify-start gap-2">
        {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-dusty-blue" />}
        {isRestoring ? "正在恢复..." : "从备份文件恢复"}
      </Button>
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
      <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="w-3 h-3 mt-0.5 shrink-0" /><span>备份文件包含您的所有健康数据，请妥善保管</span>
        </div>
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /><span>恢复时同日期的记录会被覆盖，不会删除已有数据</span>
        </div>
      </div>
    </motion.div>
  );
}
