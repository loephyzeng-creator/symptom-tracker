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
  getMedicationAdherence,
  getMedicationStockStatus,
  getLowStockAlerts,
  getIntervalMedicationStatus,
  getPainkillerUsageLast30Days,
  getPainkillerDayLimit,
  togglePainkillerForDate,
  getPainkillerAlertEnabled,
  getNotificationSoundForUser,
  getMedicationReminders,
} from "./db";
import { generateReportHTML } from "./report";
import { analyzeSymptoms } from "./aiAnalysis";
import { sendWebPush } from "./reminderScheduler";
import { getDateStrInTimezone, DEFAULT_TIMEZONE } from "../shared/timezone";

// Sub-routers extracted for maintainability
import { medRemindersRouter } from "./routers/medReminders";
import { notificationRouter } from "./routers/notification";
import { medGroupsRouter } from "./routers/medGroups";
import { drugInteractionsRouter } from "./routers/drugInteractions";

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

  // Extracted sub-routers
  notification: notificationRouter,
  medReminders: medRemindersRouter,
  medGroups: medGroupsRouter,
  drugInteractions: drugInteractionsRouter,

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
      const data = await exportUserData(ctx.user.id);
      // Record backup timestamp
      try {
        const { getDb } = await import("./db/connection");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          await db.update(users).set({ lastBackupAt: new Date() }).where(eq(users.id, ctx.user.id));
        }
      } catch (_) { /* non-critical */ }
      return data;
    }),

    /** Get last backup timestamp for the current user */
    lastBackupTime: protectedProcedure.query(async ({ ctx }) => {
      const { getDb } = await import("./db/connection");
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { lastBackupAt: null };
      const [user] = await db.select({ lastBackupAt: users.lastBackupAt }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return { lastBackupAt: user?.lastBackupAt ?? null };
    }),

    /** Restore user data from a backup JSON (v2: includes all tables) */
    restore: protectedProcedure
      .input(
        z.object({
          version: z.number().optional(),
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
                painkillerBrand: z.string().nullable().optional(),
                painkillerDosage: z.string().nullable().optional(),
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
              painkillerDayLimit: z.number().optional(),
              painkillerAlertEnabled: z.number().optional(),
              weeklyReportFrequency: z.string().optional(),
              weeklyReportHour: z.number().optional(),
              notificationSound: z.string().optional(),
              timezone: z.string().optional(),
            })
            .nullable()
            .optional(),
          medicationGroups: z
            .array(
              z.object({
                name: z.string(),
                icon: z.string().nullable().optional(),
                color: z.string().nullable().optional(),
                sortOrder: z.number().optional(),
              })
            )
            .optional(),
          medicationReminders: z
            .array(
              z.object({
                medicationName: z.string(),
                dosage: z.string(),
                reminderHour: z.number(),
                reminderMinute: z.number(),
                reminderTimes: z
                  .array(z.object({ hour: z.number(), minute: z.number() }))
                  .nullable()
                  .optional(),
                enabled: z.number().optional(),
                repeatDays: z.array(z.number()).nullable().optional(),
                offsetMinutes: z.number().optional(),
                stockQuantity: z.number().nullable().optional(),
                dailyDosageCount: z.number().nullable().optional(),
                stockAlertDays: z.number().nullable().optional(),
                instructionUrl: z.string().nullable().optional(),
                expirationDate: z.string().nullable().optional(),
                expirationAlertDays: z.number().nullable().optional(),
                groupName: z.string().nullable().optional(),
                intervalHours: z.number().nullable().optional(),
                sortOrder: z.number().optional(),
                startDate: z.string().nullable().optional(),
                endDate: z.string().nullable().optional(),
                defaultRestockQuantity: z.number().nullable().optional(),
              })
            )
            .optional(),
          medicationRestocks: z
            .array(
              z.object({
                medicationName: z.string(),
                restockQuantity: z.number(),
                restockDate: z.string(),
              })
            )
            .optional(),
          drugInteractions: z
            .array(
              z.object({
                drugA: z.string(),
                drugB: z.string(),
                severity: z.string().optional(),
                description: z.string(),
                recommendation: z.string().nullable().optional(),
                source: z.string().optional(),
              })
            )
            .optional(),
          alertRules: z
            .array(
              z.object({
                metricKey: z.string(),
                threshold: z.number().optional(),
                consecutiveDays: z.number().optional(),
                direction: z.string().optional(),
                enabled: z.number().optional(),
              })
            )
            .optional(),
          alertHistory: z
            .array(
              z.object({
                metricKey: z.string(),
                message: z.string(),
                triggeredDate: z.string(),
                isRead: z.number().optional(),
              })
            )
            .optional(),
          customMetrics: z
            .array(
              z.object({
                name: z.string(),
                description: z.string().nullable().optional(),
                icon: z.string().nullable().optional(),
                isHighGood: z.number().optional(),
                sortOrder: z.number().optional(),
              })
            )
            .optional(),
          customMetricValues: z
            .array(
              z.object({
                entryDate: z.string(),
                metricName: z.string(),
                value: z.number(),
              })
            )
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

  /** Interval-based medication status */
  intervalMeds: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return getIntervalMedicationStatus(ctx.user.id);
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

        // Fetch medication adherence data for the report period
        let adherenceData = null;
        try {
          adherenceData = await getMedicationAdherence(ctx.user.id, input.startDate, input.endDate);
        } catch { /* ignore if no adherence data */ }

        // Fetch medication reminders for the medication overview section
        let medRemindersList = null;
        try {
          const reminders = await getMedicationReminders(ctx.user.id);
          medRemindersList = reminders.map((r: any) => ({
            medicationName: r.medicationName,
            dosage: r.dosage,
            startDate: r.startDate,
            endDate: r.endDate,
            reminderTimes: r.reminderTimes,
            repeatDays: r.repeatDays,
            enabled: r.enabled,
          }));
        } catch { /* ignore */ }

        const html = generateReportHTML(
          entries,
          input.startDate,
          input.endDate,
          ctx.user.name ?? "用户",
          adherenceData,
          medRemindersList
        );
        return { html, entryCount: entries.length };
      }),
  }),
});

export type AppRouter = typeof appRouter;
