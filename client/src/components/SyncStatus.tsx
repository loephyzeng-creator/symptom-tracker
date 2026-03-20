/**
 * SyncStatus — 数据同步状态卡片
 * 显示云端数据状态：记录总数、最后更新时间、日期范围、同步状态指示
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Cloud, CloudOff, RefreshCw, Database, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return new Date(isoStr).toLocaleDateString("zh-CN");
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

export default function SyncStatus() {
  const { data, isLoading, error, refetch } = trpc.sync.status.useQuery(undefined, {
    staleTime: 30000, // 30s cache
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const isOnline = !error;
  const hasData = data && data.totalEntries > 0;

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Cloud className="w-4 h-4 text-sage" />
          ) : (
            <CloudOff className="w-4 h-4 text-destructive" />
          )}
          <h3 className="font-serif text-sm font-bold text-foreground">
            云端数据状态
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
          />
          刷新
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">查询中...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-destructive/10 p-3">
          <p className="text-xs text-destructive font-medium">
            无法连接云端服务，请检查网络连接
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-sage animate-pulse" : "bg-destructive"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isOnline ? "已连接云端 · 数据自动同步" : "离线状态"}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-background/60 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Database className="w-3 h-3 text-terracotta" />
                <span className="text-[10px] text-muted-foreground">记录总数</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {data?.totalEntries ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">条</span>
              </p>
            </div>

            <div className="rounded-lg bg-background/60 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-dusty-blue" />
                <span className="text-[10px] text-muted-foreground">最后更新</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {data?.latestUpdate
                  ? formatRelativeTime(data.latestUpdate)
                  : "暂无数据"}
              </p>
            </div>
          </div>

          {/* Date range */}
          {hasData && data.firstDate && data.lastDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>
                记录范围：{formatDate(data.firstDate)} — {formatDate(data.lastDate)}
              </span>
            </div>
          )}

          {/* Sync note */}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            所有数据已安全存储在云端数据库中，支持多设备访问。登录同一账号即可在不同设备上查看和编辑数据。
          </p>
        </div>
      )}
    </div>
  );
}
