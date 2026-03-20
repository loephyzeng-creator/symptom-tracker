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
} from "./db";
import { generateReportHTML } from "./report";

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
