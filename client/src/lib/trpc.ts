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
  saveMedReminders, confirmMedTaken, unconfirmMedTaken,
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

// ─── Utility: reactive query hook ────────────────────────────────────────────
function useQuery<T>(fetcher: () => T, deps: any[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const load = useCallback(() => {
    try { setData(fetchRef.current()); } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => { load(); }, [...deps, load]);
  return { data, isLoading, refetch: load };
}

// ─── Utility: mutation hook ───────────────────────────────────────────────────
function useMutation<TInput, TOutput>(
  fn: (input: TInput) => TOutput,
  options?: { onSuccess?: (data: TOutput) => void; onError?: (err: any) => void }
) {
  const [isPending, setIsPending] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const optRef = useRef(options);
  optRef.current = options;
  const mutateAsync = useCallback(async (input: TInput): Promise<TOutput> => {
    setIsPending(true);
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
  return { mutate, mutateAsync, isPending, isLoading: isPending };
}

// ─── Utils (cache invalidation — no-op in localStorage world) ────────────────
const makeProxy = (): any => new Proxy({}, { get: () => makeProxy(), apply: () => {} });

// ─── Main trpc mock object ────────────────────────────────────────────────────
export const trpc = {
  useUtils: () => makeProxy(),

  entries: {
    list: { useQuery: () => useQuery(() => getEntries()) },
    painkillerUsage: {
      useQuery: () => useQuery(() => ({ count: getPainkillerUsageLast30Days(getLocalDateStr()) })),
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
    todayMeds: { useQuery: () => useQuery(() => getTodayMedications()) },
    stockStatus: { useQuery: () => useQuery(() => getMedStockStatus()) },
    missedAlerts: { useQuery: () => useQuery(() => getMissedMedAlerts()) },
    archivedStats: { useQuery: () => useQuery(() => getArchivedMedStats()) },
    intervalStatus: { useQuery: () => useQuery(() => getIntervalMedStatus()) },
    adherence: {
      useQuery: (input?: any) => {
        const { startDate, endDate } = input ?? {};
        return useQuery(() => getMedAdherence(startDate ?? "", endDate ?? ""), [startDate, endDate]);
      },
    },
    checkInCalendar: {
      useQuery: (input?: any) => {
        const { year, month } = input ?? {};
        return useQuery(() => getMedCheckInCalendar(year ?? new Date().getFullYear(), month ?? new Date().getMonth() + 1), [year, month]);
      },
    },
    monthlyConsumption: {
      useQuery: (input?: any) => useQuery(() => getMonthlyMedConsumption()),
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
        return useQuery(() => getMedCompletionByDates(dates ?? []), [JSON.stringify(dates)]);
      },
    },
    dayDetail: {
      useQuery: (input?: any) => {
        const { date } = input ?? {};
        return useQuery(() => getMedCheckInDayDetail(date ?? getLocalDateStr()), [date]);
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
    grouped: { useQuery: () => useQuery(() => getGroupedMedications()) },
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
      useQuery: (input?: any) => {
        const { date } = input ?? {};
        return useQuery(() => getCustomMetricValuesForDate(date ?? getLocalDateStr()), [date]);
      },
    },
    saveValues: {
      useMutation: (opts?: any) => useMutation(
        ({ date, values }: { date: string; values: Record<number, number> }) => {
          saveCustomMetricValuesForDate(date, values);
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
