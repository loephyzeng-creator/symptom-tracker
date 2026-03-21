/**
 * MedicationView — Standalone medication management tab
 * Includes: Missed medication alerts, today's medication checklist,
 * medication check-in calendar, and drug interaction checker.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import MissedMedicationAlert from "@/components/MissedMedicationAlert";
import MedicationCheckInCalendar from "@/components/MedicationCheckInCalendar";
import DrugInteractionChecker from "@/components/DrugInteractionChecker";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Pill,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Timer,
  Plus,
  X,
  CheckCheck,
} from "lucide-react";
import MedicationAutocomplete from "@/components/MedicationAutocomplete";

export default function MedicationView() {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ─── Today's medications from reminders ──────
  const utils = trpc.useUtils();
  const { data: todayMeds, isLoading: todayMedsLoading } =
    trpc.medReminders.todayMeds.useQuery(
      { date: todayStr },
      { refetchOnWindowFocus: false, staleTime: 30_000 }
    );

  const confirmTakenMutation = trpc.medReminders.confirmTaken.useMutation({
    onSuccess: () => {
      utils.medReminders.todayMeds.invalidate({ date: todayStr });
    },
  });

  const unconfirmTakenMutation = trpc.medReminders.unconfirmTaken.useMutation({
    onSuccess: () => {
      utils.medReminders.todayMeds.invalidate({ date: todayStr });
    },
  });

  const [confirmingAll, setConfirmingAll] = useState(false);

  const handleToggleMedTaken = async (
    reminderId: number,
    currentlyTaken: boolean,
    timeIndex?: number
  ) => {
    try {
      if (currentlyTaken) {
        await unconfirmTakenMutation.mutateAsync({ reminderId, timeIndex });
        toast.success("已取消服药记录");
      } else {
        await confirmTakenMutation.mutateAsync({ reminderId, timeIndex });
        toast.success("已确认服药");
      }
    } catch {
      toast.error("操作失败，请重试");
    }
  };

  const handleConfirmAll = async () => {
    if (!todayMeds || todayMeds.length === 0) return;
    const untaken = todayMeds.filter((m: any) => !m.taken);
    if (untaken.length === 0) {
      toast.success("今日药品已全部服用");
      return;
    }
    setConfirmingAll(true);
    try {
      for (const med of untaken) {
        await confirmTakenMutation.mutateAsync({
          reminderId: med.reminderId,
          timeIndex: med.timeIndex,
        });
      }
      toast.success(`已确认 ${untaken.length} 项药品全部服用`);
    } catch {
      toast.error("部分药品打卡失败，请重试");
    } finally {
      setConfirmingAll(false);
    }
  };

  // Compute taken count for display
  const takenCount = todayMeds?.filter((m: any) => m.taken).length ?? 0;
  const totalMedCount = todayMeds?.length ?? 0;

  // ─── Manual extra medications (not from reminders) ──────
  const [extraMeds, setExtraMeds] = useState<
    { name: string; dosage: string }[]
  >([]);

  const addExtraMed = () => {
    setExtraMeds((prev) => [...prev, { name: "", dosage: "" }]);
  };

  const removeExtraMed = (idx: number) => {
    setExtraMeds((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateExtraMed = (
    idx: number,
    field: "name" | "dosage",
    value: string
  ) => {
    setExtraMeds((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  return (
    <div className="space-y-4">
      {/* Missed Medication Alert */}
      <MissedMedicationAlert />

      {/* Today's Medication Checklist */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl p-4 shadow-sm border border-border/40"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-dusty-blue/10 flex items-center justify-center">
              <Pill className="w-4 h-4 text-dusty-blue" />
            </div>
            <h3 className="font-serif font-semibold text-sm">今日用药</h3>
          </div>
          <div className="flex items-center gap-2">
            {totalMedCount > 0 && takenCount < totalMedCount && (
              <button
                onClick={handleConfirmAll}
                disabled={confirmingAll}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-sage/15 text-sage hover:bg-sage/25 transition-colors disabled:opacity-50"
              >
                {confirmingAll ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3" />
                )}
                一键打卡
              </button>
            )}
            {totalMedCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  takenCount === totalMedCount
                    ? "bg-sage/15 text-sage"
                    : takenCount > 0
                      ? "bg-chart-4/15 text-chart-4"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {takenCount}/{totalMedCount} 已服
              </span>
            )}
          </div>
        </div>

        {todayMedsLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : todayMeds && todayMeds.length > 0 ? (
          <div className="space-y-2">
            {todayMeds.map((med: any) => {
              const medKey = `${med.reminderId}-${med.timeIndex ?? 0}`;
              const isToggling =
                (confirmTakenMutation.isPending &&
                  confirmTakenMutation.variables?.reminderId ===
                    med.reminderId &&
                  confirmTakenMutation.variables?.timeIndex ===
                    med.timeIndex) ||
                (unconfirmTakenMutation.isPending &&
                  unconfirmTakenMutation.variables?.reminderId ===
                    med.reminderId &&
                  unconfirmTakenMutation.variables?.timeIndex ===
                    med.timeIndex);
              return (
                <motion.button
                  key={medKey}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() =>
                    handleToggleMedTaken(
                      med.reminderId,
                      med.taken,
                      med.timeIndex
                    )
                  }
                  disabled={isToggling}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    med.taken
                      ? "bg-sage/10 border border-sage/30"
                      : "bg-muted/30 border border-border/50 hover:border-sage/40 hover:bg-sage/5"
                  } ${isToggling ? "opacity-60" : ""}`}
                >
                  {/* Checkbox */}
                  <div className="shrink-0">
                    {isToggling ? (
                      <Loader2 className="w-5 h-5 animate-spin text-sage" />
                    ) : med.taken ? (
                      <CheckCircle2 className="w-5 h-5 text-sage" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                  {/* Med info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        med.taken
                          ? "text-sage line-through"
                          : "text-foreground"
                      }`}
                    >
                      {med.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{med.dosage}</span>
                      {med.reminderHour !== undefined &&
                        med.reminderMinute !== undefined && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {String(med.reminderHour).padStart(2, "0")}:
                            {String(med.reminderMinute).padStart(2, "0")}
                          </span>
                        )}
                      {med.timeIndex !== undefined &&
                        med.timeIndex !== null && (
                          <span className="text-[10px] bg-muted/60 px-1 py-0.5 rounded">
                            第{med.timeIndex + 1}次
                          </span>
                        )}
                      {med.intervalHours && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 py-0.5 rounded flex items-center gap-0.5">
                          <Timer className="w-2.5 h-2.5" />
                          每{med.intervalHours}h
                        </span>
                      )}
                      {med.lastTakenAt &&
                        !med.taken &&
                        (() => {
                          const lastTime = new Date(med.lastTakenAt);
                          const nextTime = new Date(
                            lastTime.getTime() +
                              (med.intervalHours || 0) * 3600000
                          );
                          const now = new Date();
                          const diffMs = nextTime.getTime() - now.getTime();
                          if (diffMs > 0) {
                            const hours = Math.floor(diffMs / 3600000);
                            const mins = Math.floor(
                              (diffMs % 3600000) / 60000
                            );
                            return (
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1 py-0.5 rounded">
                                {hours}h{mins}m后可服
                              </span>
                            );
                          }
                          return null;
                        })()}
                    </div>
                  </div>
                  {/* Status badge */}
                  {med.taken && (
                    <span className="text-[10px] text-sage font-medium bg-sage/15 px-1.5 py-0.5 rounded shrink-0">
                      ✓ 已服
                    </span>
                  )}
                </motion.button>
              );
            })}

            {/* Manual add extra medication */}
            <button
              onClick={addExtraMed}
              className="w-full py-2 rounded-lg border border-dashed border-border/60 text-muted-foreground hover:border-terracotta/40 hover:text-terracotta transition-colors flex items-center justify-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              添加额外药品
            </button>

            {/* Manual medication rows */}
            {extraMeds.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/30">
                <p className="text-[11px] text-muted-foreground">额外药品</p>
                {extraMeds.map((med, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-center"
                  >
                    <MedicationAutocomplete
                      value={med.name}
                      onChange={(v) => updateExtraMed(idx, "name", v)}
                      onSelectSuggestion={(name, dosage) => {
                        setExtraMeds((prev) =>
                          prev.map((m, i) =>
                            i === idx
                              ? { ...m, name, dosage: dosage || m.dosage }
                              : m
                          )
                        );
                      }}
                      placeholder="如：布洛芬"
                      className="text-sm bg-muted/50 border-0 h-9"
                      field="name"
                    />
                    <MedicationAutocomplete
                      value={med.dosage}
                      onChange={(v) => updateExtraMed(idx, "dosage", v)}
                      placeholder="如：200mg"
                      className="text-sm bg-muted/50 border-0 h-9 w-24"
                      field="dosage"
                      currentMedName={med.name}
                    />
                    <button
                      onClick={() => removeExtraMed(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-center py-4 text-muted-foreground">
              <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无用药提醒</p>
              <p className="text-xs mt-1">
                可在设置中添加用药提醒
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Drug Interaction Checker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl p-4 shadow-sm border border-border/40"
      >
        <DrugInteractionChecker />
      </motion.div>

      {/* Medication Check-in Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <MedicationCheckInCalendar />
      </motion.div>
    </div>
  );
}
