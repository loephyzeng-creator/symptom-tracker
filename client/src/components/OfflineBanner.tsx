import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { WifiOff, CloudOff, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A floating banner that shows when the user is offline,
 * displays pending mutation count, and shows a sync success message.
 */
export function OfflineBanner() {
  const { isOnline, pendingMutations, justSynced } = useOfflineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
          style={{
            background: "linear-gradient(135deg, #b45309 0%, #92400e 100%)",
            color: "#fef3c7",
          }}
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>当前处于离线状态，正在使用缓存数据</span>
          {pendingMutations > 0 && (
            <span className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(0,0,0,0.2)" }}>
              <CloudOff className="h-3 w-3" />
              {pendingMutations} 条待同步
            </span>
          )}
        </motion.div>
      )}

      {justSynced && isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
          style={{
            background: "linear-gradient(135deg, #166534 0%, #15803d 100%)",
            color: "#dcfce7",
          }}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>离线数据已同步完成</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
