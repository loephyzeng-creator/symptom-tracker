/**
 * Missed Medication Alert Card
 * Shows warning when medications have been missed for consecutive days.
 * Displayed on the home page record tab.
 */
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Pill, X } from "lucide-react";
import { useState } from "react";

export default function MissedMedicationAlert() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const { data: alerts = [], isLoading } = trpc.medReminders.missedAlerts.useQuery(
    undefined,
    { staleTime: 5 * 60_000, refetchOnWindowFocus: false }
  );

  const visibleAlerts = alerts.filter((a: any) => !dismissed.has(a.reminderId));

  if (isLoading || visibleAlerts.length === 0) return null;

  const handleDismiss = (reminderId: number) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(reminderId);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {visibleAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 space-y-2"
        >
          {visibleAlerts.map((alert: any) => (
            <motion.div
              key={alert.reminderId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3.5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Pill className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {alert.medicationName}
                    </span>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    已连续 <span className="font-bold">{alert.missedDays}</span> 天未记录服用
                    {alert.dosage && (
                      <span className="text-red-500 dark:text-red-500">
                        {" "}({alert.dosage})
                      </span>
                    )}
                    ，请注意按时服药。
                  </p>
                </div>
                <button
                  onClick={() => handleDismiss(alert.reminderId)}
                  className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors shrink-0"
                  title="关闭提醒"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
