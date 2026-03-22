/**
 * StockChangeLogPanel — Reusable component showing stock change timeline
 * with undo (delete) buttons for restock events.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  History,
  Loader2,
  ArrowDown,
  ArrowUp,
  Undo2,
} from "lucide-react";

export default function StockChangeLogPanel({ reminderId }: { reminderId: number }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: changeLog = [], isLoading } = trpc.medReminders.stockChangeLog.useQuery(
    { reminderId },
    { staleTime: 30_000 }
  );

  const deleteRestockMutation = trpc.medReminders.deleteRestock.useMutation({
    onSuccess: () => {
      utils.medReminders.stockStatus.invalidate();
      utils.medReminders.stockChangeLog.invalidate();
      utils.medReminders.list.invalidate();
      utils.medReminders.restockHistory.invalidate();
      utils.medReminders.todayMeds.invalidate();
      setConfirmDeleteId(null);
      toast.success("已撤销补货记录");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-3 p-3 bg-muted/40 rounded-lg"
    >
      <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
        <History className="w-3 h-3" />
        库存变化日志
      </p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          加载中...
        </div>
      ) : changeLog.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无库存变化记录</p>
      ) : (
        <div className="space-y-0 max-h-48 overflow-y-auto">
          {changeLog.map((event: any, idx: number) => (
            <div
              key={`${event.date}-${event.type}-${idx}`}
              className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0 group"
            >
              {/* Timeline dot */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                event.type === 'restock'
                  ? 'bg-sage/20'
                  : 'bg-terracotta/15'
              }`}>
                {event.type === 'restock' ? (
                  <ArrowUp className="w-3 h-3 text-sage" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-terracotta" />
                )}
              </div>
              {/* Date */}
              <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                {event.date.slice(5)}
              </span>
              {/* Change */}
              <span className={`text-xs font-medium flex-1 ${
                event.type === 'restock'
                  ? 'text-sage'
                  : 'text-terracotta'
              }`}>
                {event.type === 'restock' ? `+${event.quantity}` : `-${event.quantity}`}
              </span>
              {/* Running total */}
              <span className="text-[10px] text-muted-foreground shrink-0">
                余 {event.runningTotal}
              </span>
              {/* Delete button for restock events */}
              {event.type === 'restock' && event.restockId && (
                confirmDeleteId === event.restockId ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => deleteRestockMutation.mutate({ restockId: event.restockId })}
                      disabled={deleteRestockMutation.isPending}
                      className="text-[10px] text-red-500 hover:text-red-600 font-medium"
                    >
                      {deleteRestockMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "确认"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(event.restockId)}
                    className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 hover:border-red-300"
                    title="撤销此次补货"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>撤销</span>
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
