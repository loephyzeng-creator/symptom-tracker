import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getEntriesByUserId,
  getEntriesByDateRange,
  upsertEntry,
  deleteEntryById,
  getTriggersByUserId,
  addCustomTrigger,
  deleteCustomTrigger,
  getNotificationSettings,
  upsertNotificationSettings,
  savePushSubscription,
  removePushSubscription,
  getPushSubscriptionsByUserId,
  getMedicationHistory,
  exportUserData,
  restoreUserData,
  getSyncStatus,
  getCustomMetrics,
  addCustomMetric,
  updateCustomMetric,
  deleteCustomMetric as deleteCustomMetricDb,
  getCustomMetricValues,
  saveCustomMetricValues,
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  checkAlertRules,
  getAlertHistory,
  markAlertsRead,
  getUnreadAlertCount,
  getMedicationReminders,
  addMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder,
  snoozeMedicationReminder,
  getMedicationAdherence,
  getMissedMedicationAlerts,
  getMedicationStockStatus,
  deductMedicationStock,
  getLowStockAlerts,
  batchRestockMedications,
  addMedicationRestock,
  deleteMedicationRestock,
  getRestockHistory,
  getStockChangeLog,
  getTodayMedications,
  confirmMedicationTaken,
  unconfirmMedicationTaken,
  getMedicationTimeline,
  getMedicationCheckInCalendar,
  getExpiringMedications,
  getMedicationCheckInDayDetail,
  batchUpdateMedicationReminders,
  getMedicationGroups,
  createMedicationGroup,
  updateMedicationGroup,
  deleteMedicationGroup,
  assignMedicationToGroup,
  batchAssignMedicationsToGroup,
  getMedicationRemindersGrouped,
  reorderMedicationReminders,
  confirmGroupMedicationsTaken,
  getIntervalMedicationStatus,
  getDrugInteractions,
  saveDrugInteractions,
  checkDrugInteractionsForMed,
  getMedCompletionByDates,
  getPainkillerUsageLast30Days,
  getPainkillerDayLimit,
  updatePainkillerDayLimit,
  togglePainkillerForDate,
  getPainkillerAlertEnabled,
  updatePainkillerAlertEnabled,
  getNotificationSoundForUser,
  getDb,
  getMonthlyMedicationConsumption,
} from "./db";
import { generateReportHTML } from "./report";
import { analyzeSymptoms } from "./aiAnalysis";
import { invokeLLM } from "./_core/llm";
import { sendWebPush } from "./reminderScheduler";
import { getDateTimeStrInTimezone, getDateStrInTimezone, DEFAULT_TIMEZONE } from "../shared/timezone";

const medicationSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  reminderId: z.number().optional(), // Links to medication_reminders.id
  timeIndex: z.number().optional(), // Which time slot for multi-dose reminders
});

const entryInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dizziness: z.number().min(0).max(10),
  headache: z.number().min(0).max(10),
  sleepQuality: z.number().min(0).max(10),
  anxiety: z.number().min(0).max(10),
  fatigue: z.number().min(0).max(10),
  photosensitivity: z.number().min(0).max(10),
  motionSickness: z.number().min(0).max(10),
  palpitations: z.number().min(0).max(10),
  mood: z.number().min(0).max(10),
  medications: z.array(medicationSchema).default([]),
  triggers: z.array(z.string()).default([]),
  severeHeadache: z.number().min(0).max(3).default(0), // 0=无, 1=轻微, 2=明显, 3=严重
  painkillerTaken: z.number().min(0).max(1).default(0), // 0=否, 1=是
  painkillerBrand: z.string().optional().nullable(),
  painkillerDosage: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
/**
 * Instant painkiller threshold check - called immediately when user records painkiller usage.
 * Sends push notification if usage approaches (70%) or exceeds the configured limit.
 */
async function checkPainkillerThresholdInstant(userId: number, dateStr: string) {
  const alertEnabled = await getPainkillerAlertEnabled(userId);
  if (!alertEnabled) return;

  const usageDays = await getPainkillerUsageLast30Days(userId, dateStr);
  const limit = await getPainkillerDayLimit(userId);
  const warningThreshold = Math.ceil(limit * 0.7);
  const userSound = await getNotificationSoundForUser(userId);

  if (usageDays >= limit) {
    await sendWebPush(
      userId,
      "\u26a0\ufe0f \u6b62\u75bc\u836f\u4f7f\u7528\u8d85\u9650\u63d0\u9192",
      `\u8fd130\u5929\u5185\u60a8\u5df2\u4f7f\u7528\u6b62\u75bc\u836f ${usageDays} \u5929\uff0c\u5df2\u8fbe\u5230\u8bbe\u5b9a\u4e0a\u9650\uff08${limit} \u5929\uff09\u3002\u8bf7\u6ce8\u610f\u63a7\u5236\u7528\u91cf\uff0c\u5fc5\u8981\u65f6\u54a8\u8be2\u533b\u751f\u3002`,
      "painkiller-instant-exceeded",
      [{ action: "view-trend", title: "\u67e5\u770b\u8be6\u60c5" }],
      { type: "painkiller-alert", level: "exceeded", url: "/?tab=medication" },
      userSound
    );
    console.log(`[PainkillerAlert] Instant exceeded alert: user ${userId}, ${usageDays}/${limit} days`);
  } else if (usageDays >= warningThreshold) {
    const remaining = limit - usageDays;
    await sendWebPush(
      userId,
      "\ud83d\udc8a \u6b62\u75bc\u836f\u4f7f\u7528\u63a5\u8fd1\u4e0a\u9650",
      `\u8fd130\u5929\u5185\u60a8\u5df2\u4f7f\u7528\u6b62\u75bc\u836f ${usageDays} \u5929\uff0c\u8ddd\u79bb\u4e0a\u9650\uff08${limit} \u5929\uff09\u8fd8\u5269 ${remaining} \u5929\u3002\u8bf7\u6ce8\u610f\u63a7\u5236\u7528\u91cf\u3002`,
      "painkiller-instant-warning",
      [{ action: "view-trend", title: "\u67e5\u770b\u8be6\u60c5" }],
      { type: "painkiller-alert", level: "warning", url: "/?tab=medication" },
      userSound
    );
    console.log(`[PainkillerAlert] Instant warning alert: user ${userId}, ${usageDays}/${limit} days`);
  }
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  entries: router({
    /** List all entries for the current user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getEntriesByUserId(ctx.user.id);
    }),

    /** Create or update an entry (upsert by date) */
    upsert: protectedProcedure
      .input(entryInputSchema)
      .mutation(async ({ ctx, input }) => {
        const result = await upsertEntry(ctx.user.id, {
          date: input.date,
          dizziness: input.dizziness,
          headache: input.headache,
          sleepQuality: input.sleepQuality,
          anxiety: input.anxiety,
          fatigue: input.fatigue,
          photosensitivity: input.photosensitivity,
          motionSickness: input.motionSickness,
          palpitations: input.palpitations,
          mood: input.mood,
          medications: input.medications,
          triggers: input.triggers,
          severeHeadache: input.severeHeadache,
          painkillerTaken: input.painkillerTaken,
          painkillerBrand: input.painkillerBrand ?? null,
          painkillerDosage: input.painkillerDosage ?? null,
          notes: input.notes ?? null,
        });

        // Check alert rules after saving (non-blocking)
        checkAlertRules(ctx.user.id, input.date).catch((err) =>
          console.error("[Alert] Error checking alert rules:", err)
        );

        // Instant painkiller threshold check when painkillerTaken is recorded
        if (input.painkillerTaken === 1) {
          checkPainkillerThresholdInstant(ctx.user.id, input.date).catch((err: unknown) =>
            console.error("[PainkillerAlert] Instant check error:", err)
          );
        }

        return result;
      }),

    /** Get painkiller usage count in last 30 days */
    painkillerUsage: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        const count = await getPainkillerUsageLast30Days(ctx.user.id, input.date);
        const limit = await getPainkillerDayLimit(ctx.user.id);
        return { days: count, limit };
      }),

    /** Toggle painkillerTaken for a specific date (long-press quick action) */
    togglePainkiller: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .mutation(async ({ ctx, input }) => {
        const newState = await togglePainkillerForDate(ctx.user.id, input.date);

        // Instant painkiller threshold check when toggled ON
        if (newState) {
          checkPainkillerThresholdInstant(ctx.user.id, input.date).catch((err: unknown) =>
            console.error("[PainkillerAlert] Instant check error:", err)
          );
        }

        return { painkillerTaken: newState };
      }),

    /** Update painkiller brand and dosage for an entry */
    updatePainkillerDetail: protectedProcedure
      .input(z.object({
        entryId: z.number(),
        painkillerBrand: z.string(),
        painkillerDosage: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updatePainkillerDetail } = await import("./db");
        await updatePainkillerDetail(ctx.user.id, input.entryId, input.painkillerBrand, input.painkillerDosage);
        return { success: true };
      }),

    /** Delete an entry by id */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteEntryById(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  triggers: router({
    /** List custom triggers for the current user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTriggersByUserId(ctx.user.id);
    }),

    /** Add a custom trigger */
    add: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return addCustomTrigger(ctx.user.id, input.name);
      }),

    /** Delete a custom trigger */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCustomTrigger(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  notification: router({
    /** Get notification settings for current user */
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getNotificationSettings(ctx.user.id);
      const subs = await getPushSubscriptionsByUserId(ctx.user.id);
      return {
        ...(settings ?? {
          enabled: 1,
          reminderHour: 21,
          reminderMinute: 0,
          painkillerDayLimit: 10,
          painkillerAlertEnabled: 1,
          weeklyReportFrequency: "weekly" as const,
          weeklyReportHour: 19,
          notificationSound: "default" as const,
          timezone: "Asia/Shanghai",
        }),
        hasPushSubscription: subs.length > 0,
      };
    }),

    /** Update painkiller day limit */
    updatePainkillerLimit: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(30) }))
      .mutation(async ({ ctx, input }) => {
        await updatePainkillerDayLimit(ctx.user.id, input.limit);
        return { success: true, limit: input.limit };
      }),

    /** Get painkiller alert enabled status */
    getPainkillerAlertEnabled: protectedProcedure.query(async ({ ctx }) => {
      const enabled = await getPainkillerAlertEnabled(ctx.user.id);
      return { enabled };
    }),

    /** Toggle painkiller threshold alert on/off */
    updatePainkillerAlertEnabled: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await updatePainkillerAlertEnabled(ctx.user.id, input.enabled);
        return { success: true, enabled: input.enabled };
      }),

    /** Update weekly report frequency */
    updateWeeklyReportFrequency: protectedProcedure
      .input(z.object({ frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { notificationSettings: ns } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const existing = await getNotificationSettings(ctx.user.id);
        if (existing) {
          await db.update(ns).set({ weeklyReportFrequency: input.frequency }).where(eqOp(ns.userId, ctx.user.id));
        } else {
          await db.insert(ns).values({ userId: ctx.user.id, weeklyReportFrequency: input.frequency });
        }
        return { success: true, frequency: input.frequency };
      }),

    /** Update weekly report hour */
    updateWeeklyReportHour: protectedProcedure
      .input(z.object({ hour: z.number().min(0).max(23) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { notificationSettings: ns } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const existing = await getNotificationSettings(ctx.user.id);
        if (existing) {
          await db.update(ns).set({ weeklyReportHour: input.hour }).where(eqOp(ns.userId, ctx.user.id));
        } else {
          await db.insert(ns).values({ userId: ctx.user.id, weeklyReportHour: input.hour });
        }
        return { success: true, hour: input.hour };
      }),

    /** Update notification sound preference */
    updateNotificationSound: protectedProcedure
      .input(z.object({ sound: z.enum(["default", "gentle", "urgent", "silent"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { notificationSettings: ns } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const existing = await getNotificationSettings(ctx.user.id);
        if (existing) {
          await db.update(ns).set({ notificationSound: input.sound }).where(eqOp(ns.userId, ctx.user.id));
        } else {
          await db.insert(ns).values({ userId: ctx.user.id, notificationSound: input.sound });
        }
        return { success: true, sound: input.sound };
      }),

    /** Auto-detect and save browser timezone (called on first login / app load) */
    setTimezone: protectedProcedure
      .input(z.object({ timezone: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const settings = await getNotificationSettings(ctx.user.id);
        // Only auto-set if user has no settings yet or timezone is still the default
        if (!settings || !settings.timezone || settings.timezone === DEFAULT_TIMEZONE) {
          await upsertNotificationSettings(ctx.user.id, {
            enabled: settings?.enabled ?? 1,
            reminderHour: settings?.reminderHour ?? 21,
            reminderMinute: settings?.reminderMinute ?? 0,
            timezone: input.timezone,
          });
          return { updated: true, timezone: input.timezone };
        }
        return { updated: false, timezone: settings.timezone };
      }),

    /** Update notification settings */
    updateSettings: protectedProcedure
      .input(
        z.object({
          enabled: z.number().min(0).max(1),
          reminderHour: z.number().min(0).max(23),
          reminderMinute: z.number().min(0).max(59),
          timezone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return upsertNotificationSettings(ctx.user.id, input);
      }),

    /** Save a Web Push subscription */
    subscribe: protectedProcedure
      .input(
        z.object({
          endpoint: z.string().url(),
          keys: z.object({
            p256dh: z.string(),
            auth: z.string(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await savePushSubscription(ctx.user.id, input);
        return { success: true };
      }),

    /** Remove a Web Push subscription */
    unsubscribe: protectedProcedure
      .input(
        z.object({
          endpoint: z.string().url(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await removePushSubscription(ctx.user.id, input.endpoint);
        return { success: true };
      }),
  }),

  medications: router({
    /** Get medication history for autocomplete */
    history: protectedProcedure.query(async ({ ctx }) => {
      return getMedicationHistory(ctx.user.id);
    }),
  }),

  customMetrics: router({
    /** List all custom metrics for the current user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getCustomMetrics(ctx.user.id);
    }),

    /** Add a new custom metric */
    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(255).optional(),
          icon: z.string().max(50).optional(),
          isHighGood: z.number().min(0).max(1).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return addCustomMetric(ctx.user.id, input);
      }),

    /** Update a custom metric */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(255).optional(),
          icon: z.string().max(50).optional(),
          isHighGood: z.number().min(0).max(1).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return updateCustomMetric(ctx.user.id, id, data);
      }),

    /** Delete a custom metric */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteCustomMetricDb(ctx.user.id, input.id);
        return { success: true };
      }),

    /** Get custom metric values for an entry */
    getValues: protectedProcedure
      .input(z.object({ entryId: z.number() }))
      .query(async ({ input }) => {
        return getCustomMetricValues(input.entryId);
      }),

    /** Save custom metric values for an entry */
    saveValues: protectedProcedure
      .input(
        z.object({
          entryId: z.number(),
          values: z.array(
            z.object({
              metricId: z.number(),
              value: z.number().min(0).max(10),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        await saveCustomMetricValues(input.entryId, input.values);
        return { success: true };
      }),
  }),

  sync: router({
    /** Get sync status (total entries, latest update, date range) */
    status: protectedProcedure.query(async ({ ctx }) => {
      return getSyncStatus(ctx.user.id);
    }),
  }),

  backup: router({
    /** Export all user data as a complete backup */
    export: protectedProcedure.query(async ({ ctx }) => {
      return exportUserData(ctx.user.id);
    }),

    /** Restore user data from a backup JSON */
    restore: protectedProcedure
      .input(
        z.object({
          entries: z
            .array(
              z.object({
                date: z.string(),
                dizziness: z.number().optional(),
                headache: z.number().optional(),
                sleepQuality: z.number().optional(),
                anxiety: z.number().optional(),
                fatigue: z.number().optional(),
                photosensitivity: z.number().optional(),
                motionSickness: z.number().optional(),
                palpitations: z.number().optional(),
                mood: z.number().optional(),
                medications: z
                  .array(z.object({ name: z.string(), dosage: z.string() }))
                  .optional(),
                triggers: z.array(z.string()).optional(),
                severeHeadache: z.number().optional(),
                painkillerTaken: z.number().optional(),
                notes: z.string().nullable().optional(),
              })
            )
            .optional(),
          customTriggers: z
            .array(z.object({ name: z.string() }))
            .optional(),
          notificationSettings: z
            .object({
              enabled: z.number(),
              reminderHour: z.number(),
              reminderMinute: z.number(),
            })
            .nullable()
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await restoreUserData(ctx.user.id, input);
        return result;
      }),
  }),

  ai: router({
    /** Run AI-powered deep analysis on symptom data */
    analyze: protectedProcedure.mutation(async ({ ctx }) => {
      const entries = await getEntriesByUserId(ctx.user.id);
      if (!entries || entries.length === 0) {
        return { analysis: "暂无足够的数据进行分析。请至少记录几天的症状数据后再尝试 AI 分析。" };
      }

      // Fetch medication adherence data for the analysis period
      const sortedEntries = [...entries].sort((a: any, b: any) => a.date.localeCompare(b.date));
      const startDate = (sortedEntries[0] as any).date;
      const endDate = (sortedEntries[sortedEntries.length - 1] as any).date;
      let adherenceData = null;
      try {
        adherenceData = await getMedicationAdherence(ctx.user.id, startDate, endDate);
      } catch { /* ignore if no adherence data */ }

      // Fetch stock status
      let stockData = null;
      try {
        stockData = await getMedicationStockStatus(ctx.user.id);
      } catch { /* ignore */ }

      const analysis = await analyzeSymptoms(entries as any, adherenceData, stockData);
      return { analysis };
    }),
  }),

  alerts: router({
    /** List all alert rules for the current user */
    listRules: protectedProcedure.query(async ({ ctx }) => {
      return getAlertRules(ctx.user.id);
    }),

    /** Create a new alert rule */
    createRule: protectedProcedure
      .input(
        z.object({
          metricKey: z.string(),
          threshold: z.number().min(0).max(10),
          consecutiveDays: z.number().min(1).max(30),
          direction: z.enum(["above", "below"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await createAlertRule({
          userId: ctx.user.id,
          ...input,
        });
        return { id };
      }),

    /** Update an alert rule */
    updateRule: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          metricKey: z.string().optional(),
          threshold: z.number().min(0).max(10).optional(),
          consecutiveDays: z.number().min(1).max(30).optional(),
          direction: z.enum(["above", "below"]).optional(),
          enabled: z.number().min(0).max(1).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateAlertRule(id, ctx.user.id, data);
        return { success: true };
      }),

    /** Delete an alert rule */
    deleteRule: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteAlertRule(input.id, ctx.user.id);
        return { success: true };
      }),

    /** Get alert history */
    history: protectedProcedure.query(async ({ ctx }) => {
      return getAlertHistory(ctx.user.id);
    }),

    /** Get unread alert count */
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadAlertCount(ctx.user.id);
    }),

    /** Mark all alerts as read */
    markRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAlertsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  medReminders: router({
    /** List all medication reminders for the current user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getMedicationReminders(ctx.user.id);
    }),

    /** Get monthly medication consumption trend (last N months) */
    monthlyConsumption: protectedProcedure
      .input(z.object({ months: z.number().min(1).max(12).optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getMonthlyMedicationConsumption(ctx.user.id, input?.months ?? 6);
      }),

    /** Add a new medication reminder */
    add: protectedProcedure
      .input(
        z.object({
          medicationName: z.string().min(1).max(200),
          dosage: z.string().min(1).max(100),
          reminderHour: z.number().min(0).max(23),
          reminderMinute: z.number().min(0).max(59),
          reminderTimes: z.array(z.object({ hour: z.number().min(0).max(23), minute: z.number().min(0).max(59) })).nullable().optional(),
          repeatDays: z.array(z.number().min(0).max(6)).optional(),
          offsetMinutes: z.number().min(-120).max(120).optional(),
          stockQuantity: z.number().min(0).nullable().optional(),
          dailyDosageCount: z.number().min(1).max(20).optional(),
          stockAlertDays: z.number().min(1).max(90).optional(),
          instructionUrl: z.string().url().max(2000).nullable().optional(),
          expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          expirationAlertDays: z.number().min(1).max(365).optional(),
          groupId: z.number().nullable().optional(),
          intervalHours: z.number().min(1).max(72).nullable().optional(),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          defaultRestockQuantity: z.number().min(1).max(9999).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return addMedicationReminder(ctx.user.id, input);
      }),

    /** Update a medication reminder */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          medicationName: z.string().min(1).max(200).optional(),
          dosage: z.string().min(1).max(100).optional(),
          reminderHour: z.number().min(0).max(23).optional(),
          reminderMinute: z.number().min(0).max(59).optional(),
          reminderTimes: z.array(z.object({ hour: z.number().min(0).max(23), minute: z.number().min(0).max(59) })).nullable().optional(),
          enabled: z.number().min(0).max(1).optional(),
          repeatDays: z.array(z.number().min(0).max(6)).optional(),
          offsetMinutes: z.number().min(-120).max(120).optional(),
          stockQuantity: z.number().min(0).nullable().optional(),
          dailyDosageCount: z.number().min(1).max(20).optional(),
          stockAlertDays: z.number().min(1).max(90).optional(),
          instructionUrl: z.string().url().max(2000).nullable().optional(),
          expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          expirationAlertDays: z.number().min(1).max(365).optional(),
          groupId: z.number().nullable().optional(),
          intervalHours: z.number().min(1).max(72).nullable().optional(),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          defaultRestockQuantity: z.number().min(1).max(9999).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateMedicationReminder(id, ctx.user.id, data);
        return { success: true };
      }),

    /** Snooze a medication reminder for 15 minutes */
    snooze: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Calculate snooze time: now + 15 minutes in user's timezone
        const snoozeTime = new Date(Date.now() + 15 * 60 * 1000);
        const snoozeUntil = getDateTimeStrInTimezone(DEFAULT_TIMEZONE, snoozeTime).replace(" ", "T");
        await snoozeMedicationReminder(input.id, ctx.user.id, snoozeUntil);
        return { success: true, snoozeUntil };
      }),

    /** Delete a medication reminder */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMedicationReminder(input.id, ctx.user.id);
        return { success: true };
      }),

    /** Get missed medication alerts (consecutive days missed) */
    missedAlerts: protectedProcedure
      .input(
        z.object({
          threshold: z.number().min(1).max(14).optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        return getMissedMedicationAlerts(ctx.user.id, input?.threshold ?? 3);
      }),

    /** Get medication adherence statistics */
    adherence: protectedProcedure
      .input(
        z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
      .query(async ({ ctx, input }) => {
        return getMedicationAdherence(ctx.user.id, input.startDate, input.endDate);
      }),

    /** Get medication stock status */
    stockStatus: protectedProcedure
      .query(async ({ ctx }) => {
        return getMedicationStockStatus(ctx.user.id);
      }),

    /** Deduct stock for a medication (when user records taking it) */
    deductStock: protectedProcedure
      .input(z.object({ medicationName: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await deductMedicationStock(ctx.user.id, input.medicationName);
        return { success: true };
      }),

    /** Get medication timeline for history view */
    timeline: protectedProcedure
      .input(
        z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
      .query(async ({ ctx, input }) => {
        return getMedicationTimeline(ctx.user.id, input.startDate, input.endDate);
      }),

    /** Get check-in calendar data for a given month */
    checkInCalendar: protectedProcedure
      .input(
        z.object({
          year: z.number().int().min(2020).max(2100),
          month: z.number().int().min(1).max(12),
        })
      )
      .query(async ({ ctx, input }) => {
        return getMedicationCheckInCalendar(ctx.user.id, input.year, input.month);
      }),

    /** Confirm medication taken (from push notification action) */
    confirmTaken: protectedProcedure
      .input(z.object({ reminderId: z.number(), timeIndex: z.number().optional(), note: z.string().max(200).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .mutation(async ({ ctx, input }) => {
        return confirmMedicationTaken(ctx.user.id, input.reminderId, input.timeIndex, input.note, input.date);
      }),

    /** Unconfirm medication taken (remove from today's entry and restore stock) */
    unconfirmTaken: protectedProcedure
      .input(z.object({ reminderId: z.number(), timeIndex: z.number().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .mutation(async ({ ctx, input }) => {
        return unconfirmMedicationTaken(ctx.user.id, input.reminderId, input.timeIndex, input.date);
      }),

    /** Get today's medications from reminders (for auto-filling symptom form) */
    todayMeds: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        return getTodayMedications(ctx.user.id, input.date);
      }),

    /** Get medications that are expiring soon or already expired */
    expiring: protectedProcedure.query(async ({ ctx }) => {
      return getExpiringMedications(ctx.user.id);
    }),

    /** Get detailed medication check-in info for a specific day */
    dayDetail: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        return getMedicationCheckInDayDetail(ctx.user.id, input.date);
      }),

    /** Get medication completion status for multiple dates (for history filtering) */
    completionByDates: protectedProcedure
      .input(z.object({ dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366) }))
      .query(async ({ ctx, input }) => {
        return getMedCompletionByDates(ctx.user.id, input.dates);
      }),

    /** Batch delete multiple medication reminders */
    batchDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        for (const id of input.ids) {
          await deleteMedicationReminder(id, ctx.user.id);
        }
        return { success: true };
      }),

    /** Reorder medication reminders */
    reorder: protectedProcedure
      .input(z.object({ orderedIds: z.array(z.number()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        await reorderMedicationReminders(ctx.user.id, input.orderedIds);
        return { success: true };
      }),

    /** Batch update multiple medication reminders */
    batchUpdate: protectedProcedure
      .input(
        z.object({
          ids: z.array(z.number()).min(1),
          enabled: z.number().min(0).max(1).optional(),
          reminderHour: z.number().min(0).max(23).optional(),
          reminderMinute: z.number().min(0).max(59).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { ids, ...data } = input;
        await batchUpdateMedicationReminders(ctx.user.id, ids, data);
        return { success: true };
      }),

    /** Add a restock record for a single medication */
    restock: protectedProcedure
      .input(
        z.object({
          reminderId: z.number(),
          restockQuantity: z.number().min(1).max(99999),
          restockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return addMedicationRestock(ctx.user.id, input.reminderId, input.restockQuantity, input.restockDate);
      }),

    /** Get restock history for a medication */
    restockHistory: protectedProcedure
      .input(z.object({ reminderId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getRestockHistory(ctx.user.id, input.reminderId);
      }),

    /** Get stock change log (restocks + usage) for a medication */
    stockChangeLog: protectedProcedure
      .input(z.object({ reminderId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getStockChangeLog(ctx.user.id, input.reminderId);
      }),

    /** Delete a specific restock record */
    deleteRestock: protectedProcedure
      .input(z.object({ restockId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteMedicationRestock(ctx.user.id, input.restockId);
      }),

    /** Batch restock all low-stock medications */
    batchRestock: protectedProcedure
      .input(
        z.object({
          restockQuantity: z.number().min(1).max(9999),
          restockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return batchRestockMedications(ctx.user.id, input.restockQuantity, input.restockDate);
      }),
  }),

  medGroups: router({
    /** List all medication groups */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getMedicationGroups(ctx.user.id);
    }),

    /** Get reminders grouped by group */
    grouped: protectedProcedure.query(async ({ ctx }) => {
      return getMedicationRemindersGrouped(ctx.user.id);
    }),

    /** Create a new group */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          icon: z.string().optional(),
          color: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return createMedicationGroup(ctx.user.id, input);
      }),

    /** Update a group */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(100).optional(),
          icon: z.string().optional(),
          color: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateMedicationGroup(ctx.user.id, id, data);
        return { success: true };
      }),

    /** Delete a group (medications become ungrouped) */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMedicationGroup(ctx.user.id, input.id);
        return { success: true };
      }),

    /** Assign a medication to a group */
    assign: protectedProcedure
      .input(
        z.object({
          reminderId: z.number(),
          groupId: z.number().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await assignMedicationToGroup(ctx.user.id, input.reminderId, input.groupId);
        return { success: true };
      }),

    /** Batch assign medications to a group */
    batchAssign: protectedProcedure
      .input(
        z.object({
          reminderIds: z.array(z.number()),
          groupId: z.number().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await batchAssignMedicationsToGroup(ctx.user.id, input.reminderIds, input.groupId);
        return { success: true };
      }),

    /** One-tap confirm all group medications as taken */
    confirmAll: protectedProcedure
      .input(z.object({ groupId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return confirmGroupMedicationsTaken(ctx.user.id, input.groupId);
      }),
  }),

  /** Interval-based medication status */
  intervalMeds: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return getIntervalMedicationStatus(ctx.user.id);
    }),
  }),

  /** Drug interaction checking */
  drugInteractions: router({
    /** Get all saved interactions for current user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return getDrugInteractions(ctx.user.id);
    }),

    /** Check interactions for a specific medication */
    checkForMed: protectedProcedure
      .input(z.object({ medicationName: z.string() }))
      .query(async ({ ctx, input }) => {
        return checkDrugInteractionsForMed(ctx.user.id, input.medicationName);
      }),

    /** Analyze all current medications using LLM and save results */
    analyze: protectedProcedure.mutation(async ({ ctx }) => {
      // Get all active medication reminders
      const reminders = await getMedicationReminders(ctx.user.id);
      const activeMeds = reminders.filter((r) => r.enabled);

      if (activeMeds.length < 2) {
        return { interactions: [], message: "至少需要2种药品才能进行交互检查" };
      }

      const medNames = activeMeds.map((r) => `${r.medicationName} (${r.dosage})`);

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一位专业的临床药师。用户正在同时服用以下药品，请分析它们之间可能存在的药物相互作用。

请以JSON数组格式返回结果，每个元素包含：
- drugA: 药品A名称
- drugB: 药品B名称  
- severity: 严重程度 ("mild" | "moderate" | "severe")
- description: 相互作用描述（中文，简洁明了）
- recommendation: 建议措施（中文）

如果没有已知的相互作用，返回空数组 []。
只返回有临床意义的相互作用，不要编造不存在的相互作用。

重要：只返回JSON数组，不要包含其他文字。`,
            },
            {
              role: "user",
              content: `请分析以下药品组合的相互作用：\n${medNames.join("\n")}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "drug_interactions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  interactions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        drugA: { type: "string" },
                        drugB: { type: "string" },
                        severity: { type: "string", enum: ["mild", "moderate", "severe"] },
                        description: { type: "string" },
                        recommendation: { type: "string" },
                      },
                      required: ["drugA", "drugB", "severity", "description", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["interactions"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") {
          return { interactions: [], message: "分析结果为空" };
        }

        const parsed = JSON.parse(content as string);
        const interactions = parsed.interactions || [];

        // Save to database
        await saveDrugInteractions(ctx.user.id, interactions);

        return { interactions, message: `分析完成，发现 ${interactions.length} 个潜在交互` };
      } catch (err) {
        console.error("[DrugInteractions] LLM analysis error:", err);
        return { interactions: [], message: "分析失败，请稍后重试" };
      }
    }),
  }),

  report: router({
    /** Generate HTML report for a date range */
    generate: protectedProcedure
      .input(
        z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const entries = await getEntriesByDateRange(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
        const html = generateReportHTML(
          entries,
          input.startDate,
          input.endDate,
          ctx.user.name ?? "用户"
        );
        return { html, entryCount: entries.length };
      }),
  }),
});

export type AppRouter = typeof appRouter;
