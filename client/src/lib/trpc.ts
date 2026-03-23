/**
 * tRPC Mock Layer — replaces real tRPC with localStorage-backed operations.
 * All components that import { trpc } from "@/lib/trpc" will use this mock.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getEntries, updatePainkillerDetail, togglePainkillerForDate,
  getPainkillerUsageLast30Days,
} from "./local-storage/entries";
import {
  getMedReminders, addMedReminder, updateMedReminder, deleteMedReminder,
  saveMedReminders, confirmMedTaken, unconfirmMedTaken, getMedCheckIns,
  getMedRestocks, saveMedRestocks, addMedRestock, deleteMedRestock,
  getGroupedMedications, getMedAdherence, getMedCheckInCalendar,
  getMissedMedAlerts, getArchivedMedStats, getMonthlyMedConsumption,
  getMedTimeline, getMedStockStatus, getIntervalMedStatus, getMedHistory,
  getStockChangeLog, batchUpdateMedReminders, batchDeleteMedReminders,
  batchRestockMedications, getMedCompletionByDates, getTodayMedications,
  getMedCheckInDayDetail, getMedGroups, createMedGroup, updateMedGroup,
  deleteMedGroup, assignMedToGroup, confirmAllInGroup,
} from "./local-storage/medications";
import {
  getCustomMetricValuesForDate, saveCustomMetricValuesForDate,
} from "./local-storage/customMetrics";
import { getLocalDateStr } from "@shared/timezone";

// ─── Global invalidation counter ─────────────────────────────────────────────
let _invalidationCounter = 0;
const _invalidationListeners = new Set<() => void>();
function _notifyInvalidation() {
  _invalidationCounter++;
  _invalidationListeners.forEach((fn) => fn());
}
export function notifyDataChanged() { _notifyInvalidation(); }

// ─── Utility: reactive query hook ────────────────────────────────────────────
function useQuery<T>(fetcher: () => T, deps: any[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [_tick, setTick] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const load = useCallback(() => {
    try { setData(fetchRef.current()); } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { load(); }, [...deps, load, _tick]);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    _invalidationListeners.add(handler);
    return () => { _invalidationListeners.delete(handler); };
  }, []);
  return { data, isLoading, refetch: load };
}

// ─── Utility: mutation hook ───────────────────────────────────────────────────
function useMutation<TInput, TOutput>(
  fn: (input: TInput) => TOutput,
  options?: { onSuccess?: (data: TOutput) => void; onError?: (err: any) => void }
) {
  const [isPending, setIsPending] = useState(false);
  const [variables, setVariables] = useState<TInput | undefined>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optRef = useRef(options);
  optRef.current = options;
  const mutateAsync = useCallback(async (input: TInput): Promise<TOutput> => {
    setIsPending(true);
    setVariables(input);
    try {
      const result = fnRef.current(input);
      optRef.current?.onSuccess?.(result);
      return result;
    } catch (err) {
      optRef.current?.onError?.(err);
      throw err;
    } finally { setIsPending(false); }
  }, []);
  const mutate = useCallback((input: TInput) => { mutateAsync(input); }, [mutateAsync]);
  return { mutate, mutateAsync, isPending, isLoading: isPending, variables };
}

// ─── Utils (cache invalidation — triggers reactive re-fetch) ─────────────────
const makeInvalidateProxy = (): any => new Proxy(
  { invalidate: () => _notifyInvalidation() },
  {
    get: (target, prop) => {
      if (prop === 'invalidate') return target.invalidate;
      return makeInvalidateProxy();
    },
    apply: () => {}
  }
);

// ─── Main trpc mock object ────────────────────────────────────────────────────
export const trpc = {
  useUtils: () => makeInvalidateProxy(),

  entries: {
    list: { useQuery: () => useQuery(() => getEntries()) },
    painkillerUsage: {
      useQuery: (input?: any) => {
        const { date } = input ?? {};
        return useQuery(() => {
          const days = getPainkillerUsageLast30Days(date ?? getLocalDateStr());
          const limit = parseInt(localStorage.getItem("painkiller_day_limit") ?? "10");
          return { days, limit };
        }, [date]);
      },
    },
    togglePainkiller: {
      useMutation: (opts?: any) => useMutation(
        ({ date }: { date: string }) => { togglePainkillerForDate(date); return { success: true }; }, opts),
    },
    updatePainkillerDetail: {
      useMutation: (opts?: any) => useMutation(
        ({ id, brand, dosage }: any) => { updatePainkillerDetail(id, brand, dosage); return { success: true }; }, opts),
    },
  },

  medReminders: {
    list: { useQuery: () => useQuery(() => getMedReminders()) },
    todayMeds: {
      useQuery: (input?: any) => {
        const { date } = input ?? {};
        return useQuery(() => {
          const reminders = getTodayMedications(date);
          const checkIns = getMedCheckIns().filter((c) => c.date === (date ?? getLocalDateStr()));
          const result: any[] = [];
          for (const r of reminders) {
            for (let i = 0; i < r.times.length; i++) {
              const checkIn = checkIns.find((c) => c.reminderId === r.id && c.timeIndex === i);
              result.push({
                ...r,
                reminderId: r.id,
                timeIndex: i,
                totalTimes: r.times.length,
                taken: r.takenSlots.includes(i),
                name: r.medicationName,
                note: checkIn?.note ?? null,
              });
            }
          }
          return result;
        }, [date]);
      },
    },
    stockStatus: { useQuery: () => useQuery(() => {
      const items = getMedStockStatus();
      const restocks = getMedRestocks();
      return items
        .filter((item) => item.currentStock !== null)
        .map((item) => {
          const alertDays = item.stockAlertDays ?? 7;
          const isLow = item.daysRemaining !== null && item.daysRemaining <= alertDays;
          // Calculate estimated run out date
          let estimatedRunOutDate = "";
          if (item.daysRemaining !== null) {
            const d = new Date();
            d.setDate(d.getDate() + item.daysRemaining);
            estimatedRunOutDate = d.toISOString().slice(0, 10);
          }
          // Get latest restock date
          const myRestocks = restocks
            .filter((r) => r.reminderId === item.id)
            .sort((a, b) => b.restockDate.localeCompare(a.restockDate));
          const restockDate = myRestocks[0]?.restockDate ?? null;
          return {
            ...item,
            reminderId: item.id,
            alertDays,
            isLow,
            estimatedRunOutDate,
            restockDate,
            stockQuantity: item.currentStock ?? 0,
          };
        });
    }) },
    missedAlerts: { useQuery: () => useQuery(() => getMissedMedAlerts()) },
    archivedStats: { useQuery: () => useQuery(() => getArchivedMedStats()) },
    intervalStatus: { useQuery: () => useQuery(() => getIntervalMedStatus()) },
    adherence: {
      useQuery: (input?: any) => {
        const { startDate, endDate } = input ?? {};
        return useQuery(() => {
          const result = getMedAdherence(startDate ?? "", endDate ?? "");
          // Rename fields to match component expectations
          return {
            ...result,
            perMedication: result.perMed.map((m) => ({
              ...m,
              name: m.medicationName,
              taken: m.takenDoses,
              expected: m.totalDoses,
              rate: m.adherenceRate,
            })),
          };
        }, [startDate, endDate]);
      },
    },
    checkInCalendar: {
      useQuery: (input?: any) => {
        const { year, month } = input ?? {};
        return useQuery(() => {
          const calYear = year ?? new Date().getFullYear();
          const calMonth = month ?? new Date().getMonth() + 1;
          const arr = getMedCheckInCalendar(calYear, calMonth);
          // Get painkiller entries for this month
          const allEntries = getEntries();
          const monthStr = `${calYear}-${String(calMonth).padStart(2, "0")}`;
          const painkillerDates = new Set(
            allEntries
              .filter((e) => e.date.startsWith(monthStr) && e.painkillerTaken === 1)
              .map((e) => e.date)
          );
          // Convert to component-expected format
          const days = arr.map((d) => {
            let status: string;
            if (d.totalDoses === 0) {
              status = "no-schedule";
            } else if (d.takenDoses === 0) {
              status = "missed";
            } else if (d.takenDoses >= d.totalDoses) {
              status = "all-taken";
            } else {
              status = "partial";
            }
            return {
              date: d.date,
              status,
              scheduledCount: d.totalDoses,
              takenCount: d.takenDoses,
              painkillerTaken: painkillerDates.has(d.date),
            };
          });
          // Calculate current streak (consecutive days with all-taken or partial)
          const today = new Date().toISOString().slice(0, 10);
          let streak = 0;
          const sortedDays = [...days].sort((a, b) => b.date.localeCompare(a.date));
          for (const day of sortedDays) {
            if (day.date > today) continue;
            if (day.status === "all-taken" || day.status === "partial") {
              streak++;
            } else if (day.status === "missed") {
              break;
            }
          }
          return { days, streak };
        }, [year, month]);
      },
    },
    monthlyConsumption: {
      useQuery: (input?: any) => {
        const { months } = input ?? {};
        return useQuery(() => {
          const arr = getMonthlyMedConsumption(months ?? 6);
          // Convert medications from Record to array with name field
          return arr.map((m) => ({
            ...m,
            medications: Object.entries(m.medications).map(([name, count]) => ({ name, count })),
            totalCount: Object.values(m.medications).reduce((s, c) => s + c, 0),
          }));
        }, [months]);
      },
    },
    timeline: {
      useQuery: (input?: any) => {
        const { reminderId, startDate, endDate } = input ?? {};
        return useQuery(
          () => reminderId ? getMedTimeline(reminderId, startDate ?? "", endDate ?? "") : [],
          [reminderId, startDate, endDate]
        );
      },
    },
    stockChangeLog: {
      useQuery: (input?: any) => {
        const { reminderId } = input ?? {};
        return useQuery(() => reminderId ? getStockChangeLog(reminderId) : [], [reminderId]);
      },
    },
    restockHistory: {
      useQuery: (input?: any) => {
        const { reminderId } = input ?? {};
        return useQuery(() => getMedRestocks().filter((r) => r.reminderId === reminderId), [reminderId]);
      },
    },
    completionByDates: {
      useQuery: (input?: any) => {
        const { dates } = input ?? {};
        return useQuery(() => {
          const arr = getMedCompletionByDates(dates ?? []);
          // Convert array to dict keyed by date with status strings
          const result: Record<string, string> = {};
          for (const item of arr) {
            if (item.totalDoses === 0) {
              result[item.date] = "no-schedule";
            } else if (item.takenDoses === 0) {
              result[item.date] = "missed";
            } else if (item.takenDoses >= item.totalDoses) {
              result[item.date] = "all-taken";
            } else {
              result[item.date] = "partial";
            }
          }
          return result;
        }, [JSON.stringify(dates)]);
      },
    },
    dayDetail: {
      useQuery: (input?: any) => {
        const { date } = input ?? {};
        return useQuery(() => {
          const targetDate = date ?? getLocalDateStr();
          const reminders = getMedCheckInDayDetail(targetDate);
          // Get symptom entry for this date
          const entry = getEntries().find((e) => e.date === targetDate);
          const taken: Array<{ name: string; dosage: string; note?: string | null }> = [];
          const missed: Array<{ name: string; dosage: string }> = [];
          for (const r of reminders) {
            for (const t of r.times) {
              if (t.taken) {
                taken.push({ name: r.medicationName, dosage: r.dosage ?? "", note: t.note });
              } else {
                missed.push({ name: r.medicationName, dosage: r.dosage ?? "" });
              }
            }
          }
          return {
            taken,
            missed,
            headacheAttack: entry?.severeHeadache ?? 0,
            painkillerTaken: (entry?.painkillerTaken ?? 0) === 1,
          };
        }, [date]);
      },
    },
    add: {
      useMutation: (opts?: any) => useMutation((input: any) => addMedReminder(input), opts),
    },
    update: {
      useMutation: (opts?: any) => useMutation(
        ({ id, ...data }: any) => { updateMedReminder(id, data); return { success: true }; }, opts),
    },
    delete: {
      useMutation: (opts?: any) => useMutation(
        ({ id }: { id: number }) => { deleteMedReminder(id); return { success: true }; }, opts),
    },
    batchDelete: {
      useMutation: (opts?: any) => useMutation(
        ({ ids }: { ids: number[] }) => { batchDeleteMedReminders(ids); return { success: true }; }, opts),
    },
    batchUpdate: {
      useMutation: (opts?: any) => useMutation(
        ({ ids, ...data }: any) => { batchUpdateMedReminders(ids, data); return { success: true }; }, opts),
    },
    batchRestock: {
      useMutation: (opts?: any) => useMutation(
        ({ items }: { items: Array<{ reminderId: number; restockQuantity: number; restockDate: string }> }) => {
          batchRestockMedications(items);
          const reminders = getMedReminders();
          const names = items.map((i) => reminders.find((r) => r.id === i.reminderId)?.medicationName ?? "").filter(Boolean);
          return { restocked: items.length, names };
        }, opts),
    },
    reorder: {
      useMutation: (opts?: any) => useMutation(
        ({ orderedIds }: { orderedIds: number[] }) => {
          const reminders = getMedReminders();
          const reordered = orderedIds
            .map((id, idx) => { const r = reminders.find((r) => r.id === id); return r ? { ...r, sortOrder: idx } : null; })
            .filter(Boolean) as any[];
          saveMedReminders(reordered);
          return { success: true };
        }, opts),
    },
    confirmTaken: {
      useMutation: (opts?: any) => useMutation(
        ({ reminderId, date, timeIndex, note }: any) => {
          confirmMedTaken(reminderId, date, timeIndex, note);
          return { success: true };
        }, opts),
    },
    unconfirmTaken: {
      useMutation: (opts?: any) => useMutation(
        ({ reminderId, date, timeIndex }: any) => {
          unconfirmMedTaken(reminderId, date, timeIndex);
          return { success: true };
        }, opts),
    },
    restock: {
      useMutation: (opts?: any) => useMutation(
        ({ reminderId, quantity, date }: any) => { addMedRestock(reminderId, quantity, date); return { success: true }; }, opts),
    },
    deleteRestock: {
      useMutation: (opts?: any) => useMutation(
        ({ id }: { id: number }) => {
          saveMedRestocks(getMedRestocks().filter((r) => r.id !== id));
          return { success: true };
        }, opts),
    },
    snooze: {
      useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts),
    },
  },

  medications: {
    history: { useQuery: () => useQuery(() => getMedHistory().map((name) => ({ name }))) },
  },

  medGroups: {
    list: { useQuery: () => useQuery(() => getMedGroups()) },
    grouped: { useQuery: () => useQuery(() => {
      const arr = getGroupedMedications();
      // Convert to { groups: [...], ungrouped: [...] } format
      const groups: any[] = [];
      let ungrouped: any[] = [];
      for (const item of arr) {
        if (item.group === null) {
          ungrouped = item.reminders;
        } else {
          groups.push({
            ...item.group,
            medications: item.reminders,
          });
        }
      }
      return { groups, ungrouped };
    }) },
    create: {
      useMutation: (opts?: any) => useMutation(
        ({ name, color, sortOrder }: any) => createMedGroup(name, color, sortOrder), opts),
    },
    update: {
      useMutation: (opts?: any) => useMutation(
        ({ id, ...data }: any) => { updateMedGroup(id, data); return { success: true }; }, opts),
    },
    delete: {
      useMutation: (opts?: any) => useMutation(
        ({ id }: { id: number }) => { deleteMedGroup(id); return { success: true }; }, opts),
    },
    assign: {
      useMutation: (opts?: any) => useMutation(
        ({ reminderId, groupId }: any) => { assignMedToGroup(reminderId, groupId); return { success: true }; }, opts),
    },
    confirmAll: {
      useMutation: (opts?: any) => useMutation(
        ({ groupId, date }: any) => { confirmAllInGroup(groupId, date); return { success: true }; }, opts),
    },
  },

  customMetrics: {
    getValues: {
      useQuery: (input?: any, opts?: any) => {
        const { date, entryId } = input ?? {};
        // SymptomForm passes entryId; we map it to date via the entry lookup
        // We need to return an array of { metricId, value } objects
        return useQuery(() => {
          let targetDate = date ?? getLocalDateStr();
          if (entryId) {
            // Look up the date from the entry
            const entries = getEntries();
            const entry = entries.find((e: any) => e.id === entryId);
            if (entry) targetDate = entry.date;
          }
          const record = getCustomMetricValuesForDate(targetDate);
          return Object.entries(record).map(([metricId, value]) => ({
            metricId: Number(metricId),
            value,
          }));
        }, [date, entryId]);
      },
    },
    saveValues: {
      useMutation: (opts?: any) => useMutation(
        ({ date, entryId, values }: { date?: string; entryId?: number; values: Record<number, number> | Array<{metricId: number; value: number}> }) => {
          let targetDate = date ?? getLocalDateStr();
          if (entryId) {
            const entries = getEntries();
            const entry = entries.find((e: any) => e.id === entryId);
            if (entry) targetDate = entry.date;
          }
          // Convert array format to Record format if needed
          let record: Record<number, number>;
          if (Array.isArray(values)) {
            record = {};
            for (const v of values) {
              record[v.metricId] = v.value;
            }
          } else {
            record = values;
          }
          saveCustomMetricValuesForDate(targetDate, record);
          return { success: true };
        }, opts),
    },
  },

  notification: {
    getSettings: {
      useQuery: () => useQuery(() => ({
        painkillerDayLimit: parseInt(localStorage.getItem("painkiller_day_limit") ?? "10"),
        painkillerAlertEnabled: 0,
        weeklyReportFrequency: "weekly",
        weeklyReportHour: 19,
        notificationSound: "default",
      })),
    },
    subscribe: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
    unsubscribe: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
    updateSettings: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
    updatePainkillerLimit: {
      useMutation: (opts?: any) => useMutation(
        ({ limit }: { limit: number }) => {
          localStorage.setItem("painkiller_day_limit", String(limit));
          return { success: true };
        }, opts),
    },
    updatePainkillerAlertEnabled: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
    updateWeeklyReportFrequency: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
    updateWeeklyReportHour: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
    updateNotificationSound: { useMutation: (opts?: any) => useMutation(() => ({ success: true }), opts) },
  },

  ai: {
    analyze: {
      useMutation: (opts?: any) => useMutation(
        () => ({ analysis: "AI 分析功能在本地版本中不可用。请导出数据后使用在线服务进行分析。" }), opts),
    },
    chat: {
      useMutation: (opts?: any) => useMutation(() => ({ reply: "AI 聊天功能在本地版本中不可用。" }), opts),
    },
  },

  drugInteractions: {
    analyze: {
      useMutation: (opts?: any) => useMutation(
        () => ({ interactions: [], summary: "药物相互作用检查功能在本地版本中不可用。" }), opts),
    },
    list: { useQuery: () => useQuery(() => []) },
  },

  report: {
    generate: {
      useMutation: (opts?: any) => useMutation(
        ({ startDate, endDate }: { startDate: string; endDate: string }) => {
          const entries = getEntries().filter((e) => e.date >= startDate && e.date <= endDate);
          const html = `<html><body><h1>症状记录报告</h1><p>日期范围：${startDate} 至 ${endDate}</p><p>共 ${entries.length} 条记录</p></body></html>`;
          return { html, entryCount: entries.length };
        }, opts),
    },
  },
};
