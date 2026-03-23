import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import {
  getNotificationSettings,
  upsertNotificationSettings,
  savePushSubscription,
  removePushSubscription,
  getPushSubscriptionsByUserId,
  updatePainkillerDayLimit,
  getPainkillerAlertEnabled,
  updatePainkillerAlertEnabled,
  getDb,
} from "../db";
import { DEFAULT_TIMEZONE } from "../../shared/timezone";

export const notificationRouter = router({
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
      const { notificationSettings: ns } = await import("../../drizzle/schema");
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
      const { notificationSettings: ns } = await import("../../drizzle/schema");
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
      const { notificationSettings: ns } = await import("../../drizzle/schema");
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
});
