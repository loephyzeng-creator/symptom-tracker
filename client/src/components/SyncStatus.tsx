/**
 * SyncStatus — 本地数据状态卡片（静态版）
 */
import { Database, Calendar, Clock, HardDrive } from "lucide-react";
import { getEntries } from "@/lib/local-storage";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

export default function SyncStatus() {
  const entries = getEntries();
  const totalEntries = entries.length;
  const sortedDates = entries.map((e) => e.date).sort();
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="w-4 h-4 text-sage" />
        <h3 className="font-serif text-sm font-bold text-foreground">本地数据状态</h3>
      </div>
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sage" />
          <span className="text-xs text-muted-foreground">数据存储在本地设备</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-background/60 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Database className="w-3 h-3 text-terracotta" />
              <span className="text-[10px] text-muted-foreground">记录总数</span>
            </div>
            <p className="text-lg font-bold text-foreground">
              {totalEntries}<span className="text-xs font-normal text-muted-foreground ml-1">条</span>
            </p>
          </div>
          <div className="rounded-lg bg-background/60 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3 h-3 text-dusty-blue" />
              <span className="text-[10px] text-muted-foreground">存储位置</span>
            </div>
            <p className="text-sm font-semibold text-foreground">本地浏览器</p>
          </div>
        </div>
        {totalEntries > 0 && firstDate && lastDate && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>记录范围：{formatDate(firstDate)} — {formatDate(lastDate)}</span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
          数据存储在浏览器本地存储中，请定期使用"备份与恢复"功能导出数据以防丢失。
        </p>
      </div>
    </div>
  );
}
