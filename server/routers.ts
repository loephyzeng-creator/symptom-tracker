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
  getCustomMetrics,
  addCustomMetric,
  updateCustomMetric,
  deleteCustomMetric as deleteCustomMetricDb,
  getCustomMetricValues,
  saveCustomMetricValues,
} from "./db";
import { generateReportHTML } from "./report";
import { analyzeSymptoms } from "./aiAnalysis";

const medicationSchema = z.object({
  name: z.string(),
  dosage: z.string(),
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
  severeHeadache: z.number().min(0).max(1).default(0),
  notes: z.string().optional().nullable(),
});

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
        return upsertEntry(ctx.user.id, {
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
          notes: input.notes ?? null,
        });
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
        }),
        hasPushSubscription: subs.length > 0,
      };
    }),

    /** Update notification settings */
    updateSettings: protectedProcedure
      .input(
        z.object({
          enabled: z.number().min(0).max(1),
          reminderHour: z.number().min(0).max(23),
          reminderMinute: z.number().min(0).max(59),
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
      const analysis = await analyzeSymptoms(entries as any);
      return { analysis };
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
