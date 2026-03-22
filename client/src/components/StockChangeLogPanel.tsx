/**
 * StockChangeLogPanel — Reusable component showing stock change timeline
 * with undo (delete) buttons for restock events.
 * Undo button is shown as a subtle icon below the restock entry,
 * clicking it opens a confirmation dialog.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Loader2,
  ArrowDown,
  ArrowUp,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StockChangeLogPanel({ reminderId }: { reminderId: number }) {
  const [undoTarget, setUndoTarget] = useState<{ id: number; quantity: number; date: string } | null>(null);
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
      setUndoTarget(null);
      toast.success("已撤销补货记录");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <>
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
                className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0"
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
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {event.date.slice(5)}
                </span>
                {/* Delete icon for restock events — right after date */}
                {event.type === 'restock' && event.restockId && (
                  <button
                    onClick={() => setUndoTarget({
                      id: event.restockId,
                      quantity: event.quantity,
                      date: event.date,
                    })}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0 -ml-1"
                    title="撤销此次补货"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
                {/* Change */}
                <span className={`text-xs font-medium ${
                  event.type === 'restock'
                    ? 'text-sage'
                    : 'text-terracotta'
                }`}>
                  {event.type === 'restock' ? `+${event.quantity}` : `-${event.quantity}`}
                </span>
                {/* Spacer */}
                <span className="flex-1" />
                {/* Running total */}
                <span className="text-[10px] text-muted-foreground shrink-0">
                  余 {event.runningTotal}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!undoTarget} onOpenChange={(open) => !open && setUndoTarget(null)}>
        <AlertDialogContent className="max-w-[340px] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">撤销补货记录</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              确定要撤销 <span className="font-medium text-foreground">{undoTarget?.date}</span> 的补货记录（<span className="font-medium text-sage">+{undoTarget?.quantity}</span>）吗？撤销后库存将相应减少，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel
              className="flex-1 mt-0"
              disabled={deleteRestockMutation.isPending}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              disabled={deleteRestockMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (undoTarget) {
                  deleteRestockMutation.mutate({ restockId: undoTarget.id });
                }
              }}
            >
              {deleteRestockMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "确认撤销"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
